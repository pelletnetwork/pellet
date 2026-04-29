import { decodeEventLine, type LabelMap } from "@/lib/oli/decode";
import { formatTimeAgo, shortHash } from "@/lib/oli/format";
import type { RecentEventRow } from "@/lib/oli/queries";
import { ProvenanceBadge } from "./ProvenanceBadge";

export function EventStream({
  events,
  labelMap,
}: {
  events: RecentEventRow[];
  labelMap: LabelMap;
}) {
  if (events.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--color-text-quaternary)",
          fontSize: 13,
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          background: "var(--color-bg-subtle)",
        }}
      >
        no events yet — waiting for the next ingest cycle
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        background: "var(--color-bg-subtle)",
      }}
    >
      {events.map((e) => {
        const decoded = decodeEventLine(
          {
            agentId: e.agentId,
            agentLabel: e.agentLabel,
            kind: e.kind,
            counterpartyAddress: e.counterpartyAddress,
            amountWei: e.amountWei,
            tokenAddress: e.tokenAddress,
            ts: e.ts,
          },
          labelMap,
        );
        return (
          <div
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr auto auto",
              gap: 12,
              alignItems: "center",
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border-subtle)",
              fontSize: 13,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-quaternary)",
              }}
            >
              {formatTimeAgo(e.ts)}
            </span>
            <span style={{ color: "var(--color-text-primary)" }}>{decoded.summary}</span>
            <a
              href={`https://explore.tempo.xyz/tx/${e.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-text-tertiary)",
                textDecoration: "none",
              }}
            >
              tx {shortHash(e.txHash)}
            </a>
            <ProvenanceBadge sourceBlock={e.sourceBlock} methodologyVersion={e.methodologyVersion} />
          </div>
        );
      })}
    </div>
  );
}
