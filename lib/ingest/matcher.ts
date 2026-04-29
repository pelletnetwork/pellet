// Methodology version stamped onto every match. Bump when changing how
// summaries / kinds / agent matching work in a way that would yield different
// rows for the same input. Pellet OLI's reproducibility guarantee depends on
// this — a row's methodology_version + source_block reproduces its summary.
const METHODOLOGY_VERSION = "v0.1";

// Known event-topic-0 hashes → kinds. Extend as we identify more.
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const KIND_BY_TOPIC: Record<string, string> = {
  [TRANSFER_TOPIC]: "transfer",
};

export type RawEventRow = {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  contract: string;
  eventType: string;
  args: { topics: readonly string[]; data: string };
};

export type AgentLite = {
  id: string;
  label: string;
  wallets: string[]; // Plain Tempo addresses (0x + 40 hex), not topic-padded.
};

export type AgentEventMatch = {
  agentId: string;
  txHash: string;
  logIndex: number;
  ts: Date;
  kind: string;
  summary: string;
  targets: Record<string, unknown>;
  sourceBlock: number;
  methodologyVersion: string;
};

// Convert a plain address to its 32-byte topic representation.
// 0xabcd... → 0x000000000000000000000000abcd...
function toTopicAddress(addr: string): string {
  const hex = addr.replace(/^0x/i, "").toLowerCase().padStart(40, "0");
  return `0x${"0".repeat(24)}${hex}`;
}

export function matchEvent(
  evt: RawEventRow,
  agents: AgentLite[],
): AgentEventMatch[] {
  const topicsLower = (evt.args.topics ?? []).map((t) =>
    typeof t === "string" ? t.toLowerCase() : "",
  );

  const matches: AgentEventMatch[] = [];

  for (const agent of agents) {
    const walletTopics = new Set(agent.wallets.map(toTopicAddress));
    // Skip topic[0] (the event-type hash); check all indexed-arg topics.
    const involved = topicsLower
      .slice(1)
      .some((t) => t && walletTopics.has(t));
    if (!involved) continue;

    const kind = KIND_BY_TOPIC[evt.eventType.toLowerCase()] ?? "custom";
    matches.push({
      agentId: agent.id,
      txHash: evt.txHash,
      logIndex: evt.logIndex,
      ts: evt.blockTimestamp,
      kind,
      summary: buildSummary(evt, agent, kind),
      targets: { contract: evt.contract, eventType: evt.eventType },
      sourceBlock: evt.blockNumber,
      methodologyVersion: METHODOLOGY_VERSION,
    });
  }
  return matches;
}

function buildSummary(evt: RawEventRow, agent: AgentLite, kind: string): string {
  const shortContract = `${evt.contract.slice(0, 10)}…`;
  switch (kind) {
    case "transfer":
      return `${agent.label} transfer via ${shortContract}`;
    case "swap":
      return `${agent.label} swapped via ${shortContract}`;
    case "mint":
      return `${agent.label} mint via ${shortContract}`;
    default:
      return `${agent.label} interacted with ${shortContract}`;
  }
}
