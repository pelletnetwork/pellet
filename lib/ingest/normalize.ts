import type { HeliusEnhancedTx } from "../helius/types";

export type NormalizedEvent = {
  agent_id: string;
  ts: Date;
  kind: string;
  summary: string;
  targets: Record<string, unknown>;
  tx_sig: string;
  raw: HeliusEnhancedTx;
};

type AgentLite = { id: string; label: string; wallets: string[] };

const KIND_MAP: Record<string, string> = {
  SWAP: "swap",
  TRANSFER: "transfer",
  TOKEN_MINT: "mint",
  NFT_MINT: "mint",
  UNKNOWN: "program_call",
};

// Map a single Helius enhanced transaction onto our feed event shape, scoped
// to one candidate agent. Returns null when the agent had no involvement in
// the transaction (fee payer + transfer counterparties don't include any of
// the agent's known wallets).
export function normalize(
  tx: HeliusEnhancedTx,
  agent: AgentLite,
): NormalizedEvent | null {
  const wallets = new Set(agent.wallets);

  const involved =
    wallets.has(tx.feePayer) ||
    tx.tokenTransfers?.some(
      (t) => wallets.has(t.fromUserAccount) || wallets.has(t.toUserAccount),
    ) ||
    tx.nativeTransfers?.some(
      (t) => wallets.has(t.fromUserAccount) || wallets.has(t.toUserAccount),
    );

  if (!involved) return null;

  const kind = KIND_MAP[tx.type] ?? "custom";
  const summary = buildSummary(tx, agent);

  return {
    agent_id: agent.id,
    ts: new Date(tx.timestamp * 1000),
    kind,
    summary,
    targets: { source: tx.source ?? "unknown" },
    tx_sig: tx.signature,
    raw: tx,
  };
}

function buildSummary(tx: HeliusEnhancedTx, agent: AgentLite): string {
  if (tx.description) {
    // Replace any wallet address mentions with the agent label so the feed
    // reads "aixbt swapped..." instead of "AGENT_WALLET_AIXBT swapped..."
    let s = tx.description;
    for (const w of agent.wallets) {
      s = s.split(w).join(agent.label);
    }
    return s;
  }
  return `${agent.label} did ${tx.type}${tx.source ? ` via ${tx.source}` : ""}`;
}
