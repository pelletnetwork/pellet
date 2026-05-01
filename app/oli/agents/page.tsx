import Link from "next/link";
import { listAgents } from "@/lib/oli/queries";
import { fmtUsdCompact } from "@/components/specimen/dashboard-charts";

export const dynamic = "force-dynamic";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function timeAgoShort(d: Date | null): string {
  if (!d) return "—";
  const ago = Date.now() - d.getTime();
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function OliAgentsPage() {
  const list = await listAgents();

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>04</span>
            <span>Agents</span>
          </h1>
        </div>
        <div className="spec-page-subhead">
          <span>
            Watched entities — system actors, autonomous wallets, and the Pellet observer itself.
          </span>
        </div>
      </section>

      <section className="spec-tables">
        <div className="spec-table" data-table="agents-list">
          <div className="spec-table-header">
            <span className="spec-table-title">ALL AGENTS</span>
            <span className="spec-table-meta">
              <span className="spec-table-meta-faint">ROWS</span>
              <span>{list.length}</span>
            </span>
          </div>
          <div className="spec-row-head">
            <span style={{ width: 24, flexShrink: 0 }}>#</span>
            <span style={{ flex: 1, minWidth: 0 }}>AGENT</span>
            <span style={{ width: 80, flexShrink: 0 }} className="spec-cell-r">
              SOURCE
            </span>
            <span style={{ width: 56, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              TXS · 24H
            </span>
            <span style={{ width: 88, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              SPEND · 24H
            </span>
            <span style={{ width: 84, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              TOP SERVICE
            </span>
            <span style={{ width: 56, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              LAST
            </span>
            <span style={{ width: 110, flexShrink: 0, marginLeft: 24 }} className="spec-cell-r">
              WALLET
            </span>
          </div>
          {list.map((row, i) => {
            const spent = Number(row.amountSumWei24h) / 1_000_000;
            return (
              <Link key={row.id} href={`/oli/agents/${row.id}`} className="spec-row">
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
                  style={{ width: 80, flexShrink: 0, opacity: 0.7 }}
                  className="spec-cell-r"
                >
                  {row.source}
                </span>
                <span
                  style={{ width: 56, flexShrink: 0, marginLeft: 24 }}
                  className="spec-cell-r"
                >
                  {row.txCount24h.toLocaleString()}
                </span>
                <span
                  style={{ width: 88, flexShrink: 0, marginLeft: 24 }}
                  className="spec-cell-r"
                >
                  {fmtUsdCompact(spent)}
                </span>
                <span
                  style={{
                    width: 84,
                    flexShrink: 0,
                    marginLeft: 24,
                    opacity: 0.7,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  className="spec-cell-r"
                >
                  {row.topServiceLabel ?? "—"}
                </span>
                <span
                  style={{ width: 56, flexShrink: 0, marginLeft: 24, opacity: 0.7 }}
                  className="spec-cell-r"
                >
                  {timeAgoShort(row.lastActivity ? new Date(row.lastActivity) : null)}
                </span>
                <span
                  style={{ width: 110, flexShrink: 0, marginLeft: 24, opacity: 0.7 }}
                  className="spec-cell-r"
                >
                  <code style={{ fontVariantNumeric: "tabular-nums", fontFamily: "inherit" }}>
                    {row.walletAddress ? shortAddr(row.walletAddress) : "—"}
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
