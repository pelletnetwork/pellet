import { dashboardSnapshot } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { StatStrip } from "@/components/oli/StatStrip";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { EventStream } from "@/components/oli/EventStream";
import { formatUsdcAmount } from "@/lib/oli/format";

export const dynamic = "force-dynamic";

export default async function OliDashboardPage() {
  const [snap, labelMap] = await Promise.all([
    dashboardSnapshot(24),
    buildLabelMap(),
  ]);

  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
      <header>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 36,
            fontWeight: 400,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Dashboard
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
          Autonomous economic activity on Tempo, last 24 hours.
        </p>
      </header>

      <StatStrip
        stats={[
          {
            label: "MPP txs · 24h",
            value: snap.txCount.toLocaleString("en-US"),
            hint: "decoded transfer events",
          },
          {
            label: "Agents active · 24h",
            value: snap.agentsActive.toLocaleString("en-US"),
            hint: "watched entities with ≥1 event",
          },
          {
            label: "Service revenue · 24h",
            value: formatUsdcAmount(snap.amountSumWei, 6),
            hint: "sum of TIP-20 inflows",
          },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Leaderboard
          title="Top services"
          rows={snap.topServices}
          hrefFor={(r) => `/oli/services/${r.id}`}
          cols={[
            { key: "label", header: "service", cell: (r) => r.label },
            {
              key: "rev",
              header: "revenue",
              align: "right",
              cell: (r) => formatUsdcAmount(r.amountSumWei, 6),
            },
            { key: "tx", header: "txs", align: "right", width: "60px", cell: (r) => r.txCount.toLocaleString() },
          ]}
        />
        <Leaderboard
          title="Top agents"
          rows={snap.topAgents}
          hrefFor={(r) => `/oli/agents/${r.id}`}
          cols={[
            { key: "label", header: "agent", cell: (r) => r.label },
            { key: "tx", header: "txs", align: "right", width: "80px", cell: (r) => r.txCount.toLocaleString() },
          ]}
        />
      </div>

      <section>
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-text-tertiary)",
            margin: "0 0 8px",
          }}
        >
          Recent activity
        </h2>
        <EventStream events={snap.recentEvents} labelMap={labelMap} />
      </section>
    </div>
  );
}
