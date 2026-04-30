// Pellet Wallet MCP server. Wraps the existing CLI commands as MCP tools
// so any agent runtime (Claude Code, Cursor, Cloudflare Agents, the
// Anthropic API directly) can install Pellet with one config line and
// call the wallet from inside the agent loop.
//
// Tools exposed:
//   pellet_status          — read the local session: caps, expiry, label
//   pellet_pay             — sign + submit transferWithMemo on Tempo
//   pellet_balance         — on-chain USDC.e balance + remaining cap
//   pellet_recent_events   — own past payments; supports memo_prefix so
//                            agents can ask "did I already settle X?"
//   pellet_lookup_service  — search OLI for a paid endpoint by name
//
// Pairing (auth_start) is intentionally NOT exposed via MCP — it requires
// a browser passkey ceremony, which the agent can't drive. Users run
// `pellet auth start` directly once during install. The MCP layer is
// purely for spending the already-authorized session.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { defaultBaseUrl, readSession } from "../config.js";

const PAY_TOOL = {
  name: "pellet_pay",
  description:
    "Sign and broadcast a USDC payment on Tempo using the authenticated " +
    "Pellet Wallet session. The agent key is bounded by the user's " +
    "on-chain spending caps (per-call + lifetime, both enforced by Tempo " +
    "at execution). Returns the transaction hash and a public block-explorer " +
    "URL — every Pellet payment is a public on-chain receipt. Use this when " +
    "the user asks the agent to pay for something on Tempo, or when an " +
    "x402 challenge needs to be settled with a TIP-20 transferWithMemo.",
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Recipient address (0x + 40 hex chars).",
      },
      amount_usdc: {
        type: "number",
        description:
          "Amount to send, in USDC display units (e.g. 0.50 = 50 cents). " +
          "Mutually exclusive with amount_wei.",
      },
      amount_wei: {
        type: "string",
        description:
          "Raw uint256 amount in 6-decimal wei (e.g. '500000' = $0.50). " +
          "Use this when matching an exact 402 challenge amount.",
      },
      memo: {
        type: "string",
        description:
          "Optional memo. If 0x + 64 hex chars, used as the bytes32 memo " +
          "verbatim. If any other string, hashed via keccak256 to bytes32. " +
          "If omitted, memo is bytes32(0). For x402 settlement, pass the " +
          "challenge id here.",
      },
      token: {
        type: "string",
        description:
          "Optional TIP-20 token address to pay in. Defaults to the chain's " +
          "USDC.e. Must be in the wallet's on-chain authorized scope.",
      },
    },
    required: ["to"],
    additionalProperties: false,
  },
};

const STATUS_TOOL = {
  name: "pellet_status",
  description:
    "Read the local Pellet Wallet session: spend cap, per-call cap, " +
    "expiry, and whether a session exists at all. Use this to confirm the " +
    "wallet is paired before attempting a payment, or to surface remaining " +
    "spending power to the user.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

const BALANCE_TOOL = {
  name: "pellet_balance",
  description:
    "Read the wallet's on-chain USDC.e balance on Tempo plus the session's " +
    "remaining spend cap, in one call. Use this before paying to confirm " +
    "funds — the answer to 'can I afford this?' depends on BOTH on-chain " +
    "balance AND server-side remaining cap, and this surfaces both.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

const RECENT_EVENTS_TOOL = {
  name: "pellet_recent_events",
  description:
    "List the user's recent payments from the wallet's spend log. The " +
    "killer use case: pass memo_prefix to ask 'did I already settle this " +
    "x402 challenge?' before re-paying. Note: rows persisted before the " +
    "challenge_id wiring landed will have no challenge id — older payments " +
    "won't match memo_prefix even if you did pay them.",
  inputSchema: {
    type: "object",
    properties: {
      memo_prefix: {
        type: "string",
        description:
          "If supplied, only return rows whose memo starts with this " +
          "(case-insensitive). Pass an x402 challenge id here to ask 'did " +
          "I already pay this?'",
      },
      since: {
        type: "string",
        description:
          "ISO-8601 timestamp; only return events at-or-after this time. " +
          "Defaults to 24h ago.",
      },
      limit: {
        type: "integer",
        description: "Max rows to return (1-100). Default 25.",
      },
      status: {
        type: "string",
        enum: ["any", "submitted", "pending", "failed"],
        description:
          "Filter by status. Default 'submitted' (only successful pays).",
      },
    },
    additionalProperties: false,
  },
};

const LOOKUP_SERVICE_TOOL = {
  name: "pellet_lookup_service",
  description:
    "Search Pellet's OLI ledger for a paid x402/MPP endpoint by name, " +
    "label, or address fragment. Returns watched services with recent " +
    "activity. Use this before paying an unknown service to verify it's a " +
    "real, active provider others have paid. Public endpoint — no session " +
    "required.",
  inputSchema: {
    type: "object",
    properties: {
      q: {
        type: "string",
        description:
          "Search term — service slug, label, address fragment. Min 2 chars.",
      },
      limit: {
        type: "integer",
        description: "Max results (1-25). Default 10.",
      },
    },
    required: ["q"],
    additionalProperties: false,
  },
};

type PayInput = {
  to?: string;
  amount_usdc?: number;
  amount_wei?: string;
  memo?: string;
  token?: string;
};

type PayResult = {
  ok: boolean;
  tx_hash?: string;
  explorer_url?: string;
  from?: string;
  to?: string;
  amount_wei?: string;
  memo?: string;
  spend_used_wei_after?: string;
  spend_cap_wei?: string;
  error?: string;
  detail?: string;
};

export async function runMcpServer(): Promise<number> {
  const server = new Server(
    { name: "pellet-wallet", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      STATUS_TOOL,
      PAY_TOOL,
      BALANCE_TOOL,
      RECENT_EVENTS_TOOL,
      LOOKUP_SERVICE_TOOL,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params;

    if (name === "pellet_status") {
      const session = await readSession();
      if (!session) {
        return {
          content: [
            {
              type: "text",
              text:
                "No active Pellet Wallet session. Run `pellet auth start` " +
                "in a terminal to pair, then retry.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                label: session.label,
                spend_cap_usdc: Number(session.spendCapWei) / 1_000_000,
                per_call_cap_usdc: Number(session.perCallCapWei) / 1_000_000,
                expires_at: session.expiresAt,
                paired_at: session.pairedAt,
                base_url: session.baseUrl,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === "pellet_pay") {
      const args = (rawArgs ?? {}) as PayInput;
      if (!args.to) {
        return {
          isError: true,
          content: [{ type: "text", text: "missing required argument: to" }],
        };
      }
      if (typeof args.amount_usdc !== "number" && !args.amount_wei) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "must provide amount_usdc (number) or amount_wei (string)",
            },
          ],
        };
      }

      const session = await readSession();
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "no Pellet Wallet session — user must run `pellet auth start` to pair",
            },
          ],
        };
      }

      const amountWei = args.amount_wei
        ? args.amount_wei
        : String(BigInt(Math.round((args.amount_usdc as number) * 1_000_000)));

      const baseUrl =
        process.env.PELLET_BASE_URL ?? session.baseUrl ?? defaultBaseUrl();

      const result = await postWithAuth(
        `${baseUrl}/api/wallet/pay`,
        session.bearer,
        {
          to: args.to,
          amount_wei: amountWei,
          memo: args.memo ?? null,
          token: args.token,
        },
      );

      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `payment failed: ${result.error ?? "unknown"}${
                result.detail ? `\n${result.detail}` : ""
              }`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                tx_hash: result.tx_hash,
                explorer_url: result.explorer_url,
                from: result.from,
                to: result.to,
                amount_usdc: Number(result.amount_wei) / 1_000_000,
                memo: result.memo,
                spend_used_usdc: Number(result.spend_used_wei_after) / 1_000_000,
                spend_cap_usdc: Number(result.spend_cap_wei) / 1_000_000,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === "pellet_balance") {
      const session = await readSession();
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "no Pellet Wallet session — user must run `pellet auth start` to pair",
            },
          ],
        };
      }
      const baseUrl =
        process.env.PELLET_BASE_URL ?? session.baseUrl ?? defaultBaseUrl();
      const result = await getWithAuth(
        `${baseUrl}/api/wallet/balance`,
        session.bearer,
      );
      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `balance fetch failed: ${result.error ?? "unknown"}`,
            },
          ],
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }

    if (name === "pellet_recent_events") {
      const args = (rawArgs ?? {}) as {
        memo_prefix?: string;
        since?: string;
        limit?: number;
        status?: string;
      };
      const session = await readSession();
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "no Pellet Wallet session — user must run `pellet auth start` to pair",
            },
          ],
        };
      }
      const baseUrl =
        process.env.PELLET_BASE_URL ?? session.baseUrl ?? defaultBaseUrl();
      const params = new URLSearchParams();
      if (args.memo_prefix) params.set("memo_prefix", args.memo_prefix);
      if (args.since) params.set("since", args.since);
      if (typeof args.limit === "number") params.set("limit", String(args.limit));
      if (args.status) params.set("status", args.status);
      const qs = params.toString();
      const result = await getWithAuth(
        `${baseUrl}/api/wallet/events${qs ? `?${qs}` : ""}`,
        session.bearer,
      );
      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `events fetch failed: ${result.error ?? "unknown"}`,
            },
          ],
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }

    if (name === "pellet_lookup_service") {
      const args = (rawArgs ?? {}) as { q?: string; limit?: number };
      if (!args.q || args.q.trim().length < 2) {
        return {
          isError: true,
          content: [
            { type: "text", text: "q must be a string of length ≥ 2" },
          ],
        };
      }
      const limit = typeof args.limit === "number" ? args.limit : 10;
      // OLI search is public — fall back to defaultBaseUrl if no session.
      const session = await readSession();
      const baseUrl =
        process.env.PELLET_BASE_URL ??
        session?.baseUrl ??
        defaultBaseUrl();
      const url = `${baseUrl}/api/oli/search?q=${encodeURIComponent(args.q)}`;
      const result = await getWithAuth(url, null);
      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `lookup failed: ${result.error ?? "unknown"}`,
            },
          ],
        };
      }
      const hits = (result.data as { hits?: unknown[] }).hits ?? [];
      const services = hits
        .filter((h) => (h as { kind?: string }).kind === "service")
        .slice(0, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, count: services.length, results: services },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `unknown tool: ${name}` }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // server.connect resolves once stdio is wired up — but it doesn't keep
  // the process alive. Block on stdin closing so the entrypoint's
  // process.exit(code) only fires once the parent has hung up.
  await new Promise<void>((resolve) => {
    process.stdin.on("end", resolve);
    process.stdin.on("close", resolve);
  });
  return 0;
}

async function postWithAuth(
  url: string,
  bearer: string,
  body: unknown,
): Promise<PayResult> {
  let target = url;
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${bearer}`,
  };
  const serialized = JSON.stringify(body);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(target, {
      method: "POST",
      headers,
      body: serialized,
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return { ok: false, error: `redirect ${res.status} with no Location` };
      }
      target = new URL(loc, target).toString();
      continue;
    }
    const data = (await res.json()) as PayResult;
    return data;
  }
  return { ok: false, error: "too many redirects" };
}

type GetResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

async function getWithAuth(
  url: string,
  bearer: string | null,
): Promise<GetResult> {
  let target = url;
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(target, {
      method: "GET",
      headers,
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, error: `redirect ${res.status} with no Location` };
      target = new URL(loc, target).toString();
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `${res.status} ${res.statusText}` };
    }
    return { ok: true, data };
  }
  return { ok: false, error: "too many redirects" };
}
