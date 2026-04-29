import { db } from "@/lib/db/client";
import { agentEvents } from "@/lib/db/schema";
import { ingestClient } from "@/lib/rpc";
import { sql } from "drizzle-orm";

// The Tempo MPP Gateway routes payments through a settlement contract that
// emits a custom Settlement-style event. The provider address (the underlying
// service receiving funds) is in topic[2].
const SETTLEMENT_CONTRACT =
  "0x33b901018174ddabe4841042ab76ba85d4e24f25" as const;
const SETTLEMENT_TOPIC =
  "0x92ed5fe0fe56b3f4185e688efb342e92a4492b9df29ad5de596c44e64d097b51" as const;
const GATEWAY_AGENT_ID = "tempo-gateway-mpp" as const;

// Pattern B: user→gateway path. USDC.e transferWithRef-style call (selector
// 0x95777d59) has args (address recipient, uint256 amount, bytes32 ref). The
// ref's bytes 5-14 are a stable 10-byte service fingerprint set by Tempo's
// MPP client; bytes 25-31 are a per-call nonce.
const PATTERN_B_SELECTOR = "0x95777d59" as const;

function topicToAddress(topic: string): string | null {
  // Topic format: 0x + 24 zero hex chars + 40 hex chars (the address).
  const hex = topic.replace(/^0x/i, "").toLowerCase();
  if (hex.length !== 64) return null;
  return `0x${hex.slice(24)}`;
}

type AttributionResult =
  | { kind: "address"; address: string }
  | { kind: "fingerprint"; fingerprint: string }
  | null;

// Pattern A — SQL path. Settlement events are now ingested directly into
// the events table (lib/ingest/event-processor.ts), so we can JOIN instead
// of walking the receipt over RPC. Topic structure:
//   topics[0] = SETTLEMENT_TOPIC
//   topics[1] = sessionRef (bytes32, indexed)
//   topics[2] = serviceProvider (address, indexed) ← what we want
//   topics[3] = gateway (address, indexed)
async function patternAFromEvents(txHash: string): Promise<string | null> {
  const rows = await db.execute<{ provider_topic: string }>(sql`
    SELECT (args -> 'topics' ->> 2) AS provider_topic
    FROM events
    WHERE tx_hash = ${txHash}
      AND contract = ${SETTLEMENT_CONTRACT}
      AND LOWER(event_type) = ${SETTLEMENT_TOPIC}
    LIMIT 1
  `);
  const topic = rows.rows[0]?.provider_topic;
  if (!topic) return null;
  return topicToAddress(topic);
}

// Pattern B — RPC path. Calldata isn't in the events table; we still need
// to fetch the raw tx. Tempo's type-0x76 envelope keeps EVM calls in
// tx.calls[]; viem's getTransaction doesn't surface that field, so we
// query JSON-RPC directly.
async function patternBFromCalldata(txHash: string): Promise<string | null> {
  const rpcUrl = process.env.TEMPO_RPC_URL ?? "https://rpc.tempo.xyz";
  const txRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [txHash],
    }),
  });
  const txJson = (await txRes.json()) as {
    result: { calls?: Array<{ input?: string }> } | null;
  };
  const calls = txJson.result?.calls ?? [];
  for (const call of calls) {
    const inp = (call.input ?? "").toLowerCase();
    if (!inp.startsWith(PATTERN_B_SELECTOR)) continue;
    if (inp.length < 202) continue;
    const ref = inp.slice(138, 202);
    const fingerprint = ref.slice(10, 30);
    if (fingerprint && /^[0-9a-f]{20}$/.test(fingerprint)) {
      return fingerprint;
    }
  }
  return null;
}

// Try Pattern A via SQL first (free — no RPC), then Pattern B via RPC if
// no Settlement event was ingested for this tx. Returns null when neither
// path applies (rare; possible if a gateway tx came in via an unsupported
// selector).
async function attributeTx(txHash: string): Promise<AttributionResult> {
  try {
    const addr = await patternAFromEvents(txHash);
    if (addr) return { kind: "address", address: addr };

    const fp = await patternBFromCalldata(txHash);
    if (fp) return { kind: "fingerprint", fingerprint: fp };
  } catch {
    // Swallow — failures shouldn't block the cron; we'll retry next pass.
  }
  return null;
}

export async function runAttribution(limit = 100): Promise<{
  scanned: number;
  byAddress: number;
  byFingerprint: number;
  unresolved: number;
}> {
  // Pull gateway events that haven't been attributed yet (neither address
  // NOR fingerprint set). Dedupe by tx_hash so multi-row txs only do one
  // RPC fetch.
  const rows = await db.execute<{ id: number; tx_hash: string }>(sql`
    SELECT DISTINCT ON (tx_hash)
      id::int        AS id,
      tx_hash        AS tx_hash
    FROM agent_events
    WHERE agent_id = ${GATEWAY_AGENT_ID}
      AND routed_to_address IS NULL
      AND routed_fingerprint IS NULL
    ORDER BY tx_hash, id ASC
    LIMIT ${limit}
  `);

  let byAddress = 0;
  let byFingerprint = 0;
  let unresolved = 0;

  for (const r of rows.rows) {
    const result = await attributeTx(r.tx_hash);
    if (!result) {
      unresolved += 1;
      continue;
    }
    if (result.kind === "address") {
      await db
        .update(agentEvents)
        .set({ routedToAddress: result.address })
        .where(
          sql`${agentEvents.agentId} = ${GATEWAY_AGENT_ID}
              AND ${agentEvents.txHash} = ${r.tx_hash}
              AND ${agentEvents.routedToAddress} IS NULL`,
        );
      byAddress += 1;
    } else {
      await db
        .update(agentEvents)
        .set({ routedFingerprint: result.fingerprint })
        .where(
          sql`${agentEvents.agentId} = ${GATEWAY_AGENT_ID}
              AND ${agentEvents.txHash} = ${r.tx_hash}
              AND ${agentEvents.routedFingerprint} IS NULL`,
        );
      byFingerprint += 1;
    }
  }

  return { scanned: rows.rows.length, byAddress, byFingerprint, unresolved };
}
