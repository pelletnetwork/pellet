import Link from "next/link";
import { listMppServices } from "@/lib/oli/queries";
import { fmtUsdCompact } from "@/components/specimen/dashboard-charts";

export const dynamic = "force-dynamic";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default async function OliServicesPage() {
  const services = await listMppServices();

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>03</span>
            <span>Services</span>
          </h1>
        </div>
        <div className="spec-page-subhead">
          <span>
            MPP-compatible services we track. Revenue is the sum of TIP-20 inflows over the window.
          </span>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" data-table="services-list">
          <div className="spec-table-header">
            <span className="spec-table-title">ALL SERVICES</span>
            <span className="spec-table-meta">
              <span className="spec-table-meta-faint">ROWS</span>
              <span>{services.length}</span>
            </span>
          </div>
          <div className="spec-row-head">
            <span style={{ width: 24, flexShrink: 0 }}>#</span>
            <span style={{ flex: 1, minWidth: 0 }}>SERVICE</span>
            <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">
              CATEGORY
            </span>
            <span style={{ width: 88, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              REV · 24H
            </span>
            <span style={{ width: 88, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              REV · 7D
            </span>
            <span style={{ width: 56, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              TXS · 24H
            </span>
            <span style={{ width: 60, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              AGENTS · 7D
            </span>
            <span style={{ width: 110, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              ADDRESS
            </span>
          </div>
          {services.map((row, i) => {
            const rev24 = Number(row.amountSumWei24h) / 1_000_000;
            const rev7d = Number(row.amountSumWei7d) / 1_000_000;
            return (
              <Link key={row.id} href={`/oli/services/${row.id}`} className="spec-row">
                <span style={{ width: 24, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{ width: 70, flexShrink: 0, opacity: 0.7 }}
                  className="spec-cell-r"
                >
                  {row.category ?? "—"}
                </span>
                <span
                  style={{ width: 88, flexShrink: 0, marginLeft: 24 }}
                  className="spec-cell-r"
                >
                  {fmtUsdCompact(rev24)}
                </span>
                <span
                  style={{ width: 88, flexShrink: 0, marginLeft: 24 }}
                  className="spec-cell-r"
                >
                  {fmtUsdCompact(rev7d)}
                </span>
                <span
                  style={{ width: 56, flexShrink: 0, marginLeft: 24 }}
                  className="spec-cell-r"
                >
                  {row.txCount24h.toLocaleString()}
                </span>
                <span
                  style={{ width: 60, flexShrink: 0, marginLeft: 24 }}
                  className="spec-cell-r"
                >
                  {row.agentsLast7d.toLocaleString()}
                </span>
                <span
                  style={{ width: 110, flexShrink: 0, marginLeft: 24, opacity: 0.7 }}
                  className="spec-cell-r"
                >
                  <code style={{ fontVariantNumeric: "tabular-nums", fontFamily: "inherit" }}>
                    {shortAddr(row.settlementAddress)}
                  </code>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
