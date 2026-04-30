import { listMppServices } from "@/lib/oli/queries";
import { Leaderboard } from "@/components/oli/Leaderboard";
import { formatUsdcAmount, shortAddress } from "@/lib/oli/format";

export const dynamic = "force-dynamic";

export default async function OliServicesPage() {
  const services = await listMppServices();
  return (
    <div className="oli-page">
      <header>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36, fontWeight: 400, margin: 0 }}>
          Services
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", marginTop: 6, fontSize: 13 }}>
          MPP-compatible services we track. Revenue is sum of TIP-20 inflows over the window.
        </p>
      </header>

      <Leaderboard
        title={`${services.length} services`}
        rows={services}
        hrefFor={(r) => `/oli/services/${r.id}`}
        cols={[
          { key: "label", header: "service", cell: (r) => r.label, width: "1.2fr" },
          { key: "category", header: "category", cell: (r) => r.category },
          { key: "rev24", header: "rev · 24h", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei24h, 6) },
          { key: "rev7d", header: "rev · 7d", align: "right", cell: (r) => formatUsdcAmount(r.amountSumWei7d, 6) },
          { key: "tx24", header: "txs · 24h", align: "right", width: "80px", cell: (r) => r.txCount24h.toLocaleString() },
          { key: "agents7", header: "agents · 7d", align: "right", width: "80px", cell: (r) => r.agentsLast7d.toLocaleString() },
          { key: "addr", header: "address", cell: (r) => <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)" }}>{shortAddress(r.settlementAddress)}</code> },
        ]}
      />
    </div>
  );
}
