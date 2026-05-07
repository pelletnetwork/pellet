import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";
import { MPP_SERVICES, MPP_PRESETS } from "@/lib/mpp";

export function registerMppServicesTool(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.mpp.services",
    {
      title: "List available MPP services",
      description:
        "List all MPP-enabled services the wallet can pay for. Returns each service's name, category, base URL, and available presets. Use this to discover what APIs are available before calling wallet.mpp.request.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter by category (e.g. 'ai', 'search', 'web', 'data', 'blockchain'). Omit for all."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ category }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:read");

      const filtered = category
        ? MPP_SERVICES.filter((s) => s.category === category)
        : MPP_SERVICES;

      const lines = filtered.map(
        (s) => `${s.name} (${s.category}) — ${s.url}`,
      );

      const presetLines = MPP_PRESETS.map((p) => {
        const budget = Number(p.defaultBudget) / 1_000_000;
        return `${p.name}: ${p.description} — $${budget} budget [${p.serviceIds.join(", ")}]`;
      });

      const text = [
        `${filtered.length} service${filtered.length === 1 ? "" : "s"}:`,
        ...lines,
        "",
        "Presets:",
        ...presetLines,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          services: filtered.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            url: s.url,
            discoveryUrl: s.discoveryUrl,
          })),
          presets: MPP_PRESETS.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            serviceIds: p.serviceIds,
            defaultBudget: p.defaultBudget,
          })),
        },
      };
    },
  );
}
