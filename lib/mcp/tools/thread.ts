import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  insertChatMessage,
  recentChatMessages,
  type WalletChatRow,
} from "@/lib/db/wallet-chat";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";

// Two thread tools:
//   * wallet.thread.post  — agent posts a status update / question / report
//                            into the user's wallet chat thread
//   * wallet.thread.list  — agent reads recent thread history (its own +
//                            other agents' visible to this user)
//
// Both require wallet:chat scope. Posts are tagged with the agent's
// session id (from the OAuth token) so the wallet UI can group by agent.

const KIND_VALUES = ["status", "question", "approval_request", "reply", "report"] as const;
type Kind = (typeof KIND_VALUES)[number];

export function registerThreadTools(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.thread.post",
    {
      title: "Post a chat message",
      description:
        "Post a message into the user's wallet chat thread. Use kind='status' for routine updates, 'question' to ask the user something, 'report' for end-of-task summaries. For spend approval, use wallet.spend.request_approval instead — it includes the proper structured payload.",
      inputSchema: {
        content: z
          .string()
          .min(1)
          .max(8000)
          .describe("The message body (max 8000 chars)."),
        kind: z
          .enum(KIND_VALUES)
          .default("status")
          .describe(
            "Message kind. 'status' for routine updates, 'question' for asks, 'report' for summaries, 'reply' for follow-ups.",
          ),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ content, kind }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:chat");

      const row = await insertChatMessage({
        userId: auth.user.id,
        sessionId: auth.session?.id ?? null,
        sender: "agent",
        kind: kind as Kind,
        content,
      });

      return {
        content: [{ type: "text", text: `Posted: ${row.id}` }],
        structuredContent: {
          id: row.id,
          ts: row.createdAt.toISOString(),
        },
      };
    },
  );

  server.registerTool(
    "wallet.thread.list",
    {
      title: "List recent chat messages",
      description:
        "Read the user's wallet chat thread (newest first). Returns sender, kind, content, and timestamp for each message.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(50)
          .describe("Number of messages to return (max 200)."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ limit }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:chat");

      const rows = await recentChatMessages(auth.user.id, limit);
      const summary = rows
        .map(
          (r) =>
            `[${r.createdAt.toISOString()}] ${r.sender}/${r.kind}: ${r.content}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: rows.length === 0 ? "no messages" : summary,
          },
        ],
        structuredContent: {
          messages: rows.map(toWire),
        },
      };
    },
  );
}

function toWire(r: WalletChatRow) {
  return {
    id: r.id,
    sessionId: r.sessionId,
    sender: r.sender,
    kind: r.kind,
    content: r.content,
    intentId: r.intentId,
    ts: r.createdAt.toISOString(),
  };
}
