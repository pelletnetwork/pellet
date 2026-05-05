import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { authenticateMcpRequest, type McpAuthInfo } from "@/lib/mcp/auth";
import { buildPelletMcpServer } from "@/lib/mcp/server";
import { rateLimit } from "@/lib/rate-limit";
import { bus, type WalletChatRow } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ── Session store ───────────────────────────────────────────────
//
// MCP sessions let the server push notifications to connected agents.
// When a user sends a chat message, pg_notify fires → the bus emits →
// every active session for that user pushes a logging notification on
// its SSE stream. The agent receives it instantly — no polling needed.
//
// Sessions live in-memory. Vercel Fluid Compute reuses instances, so
// sessions persist across requests on the same instance. If the
// instance recycles, the MCP client reconnects and gets a new session.

interface McpSession {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  userId: string;
  clientId: string;
  createdAt: number;
  cleanup: () => void;
}

const sessions = new Map<string, McpSession>();

const SESSION_TTL = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  sessions.forEach((s, id) => {
    if (now - s.createdAt > SESSION_TTL) {
      s.cleanup();
      sessions.delete(id);
    }
  });
}, 5 * 60 * 1000);

// ── POST & DELETE ───────────────────────────────────────────────

async function handle(req: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(req);
  if (auth instanceof Response) return auth;

  const rl = rateLimit(`mcp:${auth.token.userId}`, { max: 120, windowMs: 60_000 });
  if (!rl.ok) return rl.response;

  const sessionId = req.headers.get("mcp-session-id");

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Session expired" }, id: null }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }
    if (session.userId !== auth.user.id) {
      return new Response("Forbidden", { status: 403 });
    }
    return session.transport.handleRequest(req);
  }

  // No session header — peek at body to decide stateful vs stateless
  const clone = req.clone();
  let body: unknown;
  try {
    body = await clone.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const isInit = Array.isArray(body)
    ? body.some((m: Record<string, unknown>) => m.method === "initialize")
    : (body as Record<string, unknown>)?.method === "initialize";

  if (!isInit) {
    // Non-initialize without session — handle statelessly (backwards compat)
    const server = buildPelletMcpServer(auth);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(req);
    } finally {
      await server.close().catch(() => {});
    }
  }

  // ── Initialize → new session with chat push ───────────────────

  const server = buildPelletMcpServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,

    onsessioninitialized: async (newSessionId: string) => {
      await bus().start();

      const onMessage = (row: WalletChatRow) => {
        if (row.userId !== auth.user.id) return;
        if (row.sender !== "user") return;
        if (row.clientId && row.clientId !== auth.token.clientId) return;

        try {
          server.sendLoggingMessage({
            level: "info",
            logger: "wallet.chat",
            data: {
              type: "chat.message",
              message: {
                id: row.id,
                sender: row.sender,
                kind: row.kind,
                content: row.content,
                connectionId: row.connectionId,
                ts: row.createdAt.toISOString(),
              },
            },
          });
        } catch {
          // SSE stream closed — session will be cleaned up
        }
      };

      bus().on("chat-message", onMessage);

      sessions.set(newSessionId, {
        server,
        transport,
        userId: auth.user.id,
        clientId: auth.token.clientId,
        createdAt: Date.now(),
        cleanup: () => {
          bus().off("chat-message", onMessage);
          server.close().catch(() => {});
        },
      });
    },

    onsessionclosed: (closedId: string) => {
      const session = sessions.get(closedId);
      if (session) {
        session.cleanup();
        sessions.delete(closedId);
      }
    },
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

// ── GET (SSE) ───────────────────────────────────────────────────

async function handleGet(req: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(req);
  if (auth instanceof Response) return auth;

  const sessionId = req.headers.get("mcp-session-id");

  // Session-based: MCP protocol SSE via the SDK transport.
  // The transport manages the stream — notifications pushed via
  // sendLoggingMessage() flow through here automatically.
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return new Response("Session expired", { status: 404 });
    }
    if (session.userId !== auth.user.id) {
      return new Response("Forbidden", { status: 403 });
    }
    return session.transport.handleRequest(req);
  }

  // No session → legacy custom SSE (backwards compat)
  return handleLegacySse(req, auth);
}

// ── Legacy SSE (pre-session agents) ─────────────────────────────

async function handleLegacySse(req: Request, auth: McpAuthInfo): Promise<Response> {
  const userId = auth.user.id;
  const clientId = auth.token.clientId;

  await bus().start();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const onMessage = (row: WalletChatRow) => {
        if (row.userId !== userId) return;
        if (row.sender !== "user") return;
        if (row.clientId && row.clientId !== clientId) return;

        const payload = JSON.stringify({
          type: "chat.message",
          message: {
            id: row.id,
            sender: row.sender,
            kind: row.kind,
            content: row.content,
            connectionId: row.connectionId,
            ts: row.createdAt.toISOString(),
          },
        });
        try {
          controller.enqueue(encoder.encode(`event: chat.message\ndata: ${payload}\n\n`));
        } catch {
          // stream closed
        }
      };

      const onTyping = (ev: { userId: string; connectionId: string | null; sessionId: string }) => {
        if (ev.userId !== userId) return;
        try {
          controller.enqueue(encoder.encode(`event: typing\ndata: ${JSON.stringify(ev)}\n\n`));
        } catch {
          // stream closed
        }
      };

      bus().on("chat-message", onMessage);
      bus().on("chat-typing", onTyping);

      req.signal?.addEventListener("abort", () => {
        clearInterval(heartbeat);
        bus().off("chat-message", onMessage);
        bus().off("chat-typing", onTyping);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export const POST = handle;
export const GET = handleGet;
export const DELETE = handle;
