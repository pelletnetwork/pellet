import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { insertChatMessage } from "@/lib/db/wallet-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/chat/reply
//
// Cookie-auth'd. The user posts a reply into their chat thread from the
// wallet UI. Sender is forced to 'user' regardless of body. Kind defaults
// to 'reply'.
//
// In v1 this just stores the message — there's no per-agent delivery yet.
// Phase 2 wires user replies to the agent via either:
//   * the agent's registered webhook URL
//   * the MCP resource-subscription model once the MCP server ships
//
// The message still appears in the user's own chat stream via SSE, so the
// UI feedback loop is complete from the user's side.

const MAX_CONTENT = 8_000;

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const { content, intentId } = body as {
    content?: unknown;
    intentId?: unknown;
  };

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "content must be a non-empty string" },
      { status: 400 },
    );
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json(
      { error: `content exceeds ${MAX_CONTENT} chars` },
      { status: 400 },
    );
  }

  const row = await insertChatMessage({
    userId,
    sessionId: null,
    sender: "user",
    kind: "reply",
    content: content.trim(),
    intentId: typeof intentId === "string" ? intentId : null,
  });

  return NextResponse.json({ message: row }, { status: 201 });
}
