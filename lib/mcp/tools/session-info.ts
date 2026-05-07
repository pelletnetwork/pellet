import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";

export function registerSessionInfoTool(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.session.info",
    {
      title: "Get session spend info",
      description:
        "Returns the current Access Key session's spend cap, amount used, per-call limit, remaining budget, and expiry. Use this to check how much budget is left before making payments.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:read");

      if (!auth.session) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: "no Access Key session linked to this token" },
          ],
        };
      }

      const s = auth.session;
      const cap = BigInt(s.spendCapWei);
      const used = BigInt(s.spendUsedWei);
      const remaining = cap - used;
      const perCall = BigInt(s.perCallCapWei);

      const fmt = (wei: bigint) => {
        const n = Number(wei) / 1_000_000;
        return `$${n.toFixed(n < 0.01 ? 6 : 2)}`;
      };

      const expiresIn = Math.max(
        0,
        Math.round((new Date(s.expiresAt).getTime() - Date.now()) / 1000),
      );
      const expiresHuman =
        expiresIn > 86400
          ? `${Math.floor(expiresIn / 86400)}d`
          : expiresIn > 3600
            ? `${Math.floor(expiresIn / 3600)}h`
            : `${Math.ceil(expiresIn / 60)}m`;

      const lines = [
        `Session: ${s.id}`,
        `Budget: ${fmt(used)} / ${fmt(cap)} used · ${fmt(remaining)} remaining`,
        `Per-call limit: ${fmt(perCall)}`,
        `Expires: ${expiresHuman}`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          sessionId: s.id,
          spendCapWei: s.spendCapWei,
          spendUsedWei: s.spendUsedWei,
          remainingWei: remaining.toString(),
          perCallCapWei: s.perCallCapWei,
          expiresAt: s.expiresAt.toISOString(),
          expiresInSeconds: expiresIn,
        },
      };
    },
  );
}
