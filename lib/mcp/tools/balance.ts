import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Address } from "viem";
import { readWalletBalances } from "@/lib/wallet/tempo-balance";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";

// wallet.balance.get
//
// Reads the user's stablecoin balances on Tempo (USDC.e + pathUSD on
// testnet). Returns symbol, decimal balance, and on-chain raw amount.
// Reads live from chain — no DB cache, so fresh every call.

export function registerBalanceTool(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.balance.get",
    {
      title: "Get wallet balance",
      description:
        "Read the user's current stablecoin balances on Tempo (USDC.e and pathUSD on testnet). Returns each token's symbol, address, and balance.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:read");

      const balances = await readWalletBalances(auth.user.managedAddress as Address);
      const summary = balances
        .map((b) => `${b.symbol}: ${b.display}`)
        .join(" · ");

      return {
        content: [
          {
            type: "text",
            text:
              balances.length === 0
                ? "no balances"
                : `Wallet ${auth.user.managedAddress}\n${summary}`,
          },
        ],
        structuredContent: {
          address: auth.user.managedAddress,
          balances: balances.map((b) => ({
            symbol: b.symbol,
            address: b.address,
            display: b.display,
            raw: b.raw.toString(),
          })),
        },
      };
    },
  );
}

// Re-export z so callers don't have to import zod separately when adding
// adjacent tools.
export { z };
