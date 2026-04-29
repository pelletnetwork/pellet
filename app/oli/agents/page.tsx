import { listAgents } from "@/lib/oli/queries";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { formatUsdcAmount, formatTimeAgo, shortAddress } from "@/lib/oli/format";

export const dynamic = "force-dynamic";

export default async function OliAgentsPage() {
  const list = await listAgents();
  return (
    <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>
      <header>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36, fontWeight: 400, margin: 0 }}>
          Agents
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
          Watched entities — system actors, autonomous wallets, and the Pellet observer itself.
        </p>
      </header>

      <Leaderboard
        title={`${list.length} agents`}
        rows={list}
        hrefFor={(r) => `/oli/agents/${r.id}`}
        cols={[
          { key: "label", header: "agent", cell: (r) => r.label, width: "1.2fr" },
          { key: "source", header: "source", cell: (r) => r.source },
          { key: "tx24", header: "txs · 24h", align: "right", width: "100px", cell: (r) => r.txCount24h.toLocaleString() },
          { key: "spent24", header: "amount · 24h", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei24h, 6) },
          { key: "last", header: "last", align: "right", width: "80px", cell: (r) => r.lastActivity ? formatTimeAgo(new Date(r.lastActivity)) : "—" },
          { key: "addr", header: "wallet", cell: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>{r.walletAddress ? shortAddress(r.walletAddress) : "—"}</code> },
        ]}
      />
    </div>
  );
}
