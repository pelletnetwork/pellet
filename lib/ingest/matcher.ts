const METHODOLOGY_VERSION = "v0.2"; // bumped: amount + counterparty capture

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
  wallets: string[];
};

export type AgentEventMatch = {
  agentId: string;
  txHash: string;
  logIndex: number;
  ts: Date;
  kind: string;
  summary: string;
  targets: Record<string, unknown>;
  amountWei: string | null;
  tokenAddress: string | null;
  counterpartyAddress: string | null;
  sourceBlock: number;
  methodologyVersion: string;
};

function toTopicAddress(addr: string): string {
  const hex = addr.replace(/^0x/i, "").toLowerCase().padStart(40, "0");
  return `0x${"0".repeat(24)}${hex}`;
}

function topicToAddress(topic: string): string {
  // Topic format: 0x + 24 zeros + 40 hex chars. Strip the leading zeros.
  const hex = topic.replace(/^0x/i, "").toLowerCase();
  if (hex.length !== 64) return "";
  return `0x${hex.slice(24)}`;
}

function decodeTransferAmount(dataHex: string): string | null {
  // Transfer.data is the uint256 value, ABI-encoded as 32-byte big-endian.
  const hex = dataHex.replace(/^0x/i, "");
  if (hex.length < 64) return null;
  // Take the first 32 bytes; convert to decimal string via BigInt.
  try {
    return BigInt(`0x${hex.slice(0, 64)}`).toString(10);
  } catch {
    return null;
  }
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
    const matchedTopicIdx = topicsLower
      .slice(1)
      .findIndex((t) => t && walletTopics.has(t));
    if (matchedTopicIdx === -1) continue;

    const isTransfer = evt.eventType.toLowerCase() === TRANSFER_TOPIC;
    const kind = KIND_BY_TOPIC[evt.eventType.toLowerCase()] ?? "custom";

    let amountWei: string | null = null;
    let tokenAddress: string | null = null;
    let counterpartyAddress: string | null = null;

    if (isTransfer && topicsLower.length >= 3) {
      amountWei = decodeTransferAmount(evt.args.data);
      tokenAddress = evt.contract.toLowerCase();
      // The counterparty is whichever of topics[1]/topics[2] ISN'T the agent.
      const fromTopic = topicsLower[1];
      const toTopic = topicsLower[2];
      const matchedTopic = matchedTopicIdx === 0 ? fromTopic : toTopic;
      const otherTopic = matchedTopic === fromTopic ? toTopic : fromTopic;
      if (otherTopic) counterpartyAddress = topicToAddress(otherTopic);
    }

    matches.push({
      agentId: agent.id,
      txHash: evt.txHash,
      logIndex: evt.logIndex,
      ts: evt.blockTimestamp,
      kind,
      summary: buildSummary(evt, agent, kind),
      targets: { contract: evt.contract, eventType: evt.eventType },
      amountWei,
      tokenAddress,
      counterpartyAddress,
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
