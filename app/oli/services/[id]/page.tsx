import { serviceDetail } from "@/lib/oli/queries";
import { buildLabelMap } from "@/lib/oli/labelMap";
import { TrendChart } from "@/components/oli/TrendChart";
import { EventStream } from "@/components/oli/EventStream";
import { shortAddress } from "@/lib/oli/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OliServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, labelMap] = await Promise.all([
    serviceDetail(id),
    buildLabelMap(),
  ]);

  if (!detail.head) notFound();

  const trendPoints = detail.trend.map((t) => ({
    ts: new Date(t.bucket),
    value: Number(t.amountWei) / 1_000_000, // USDC.e (6 decimals)
  }));

  return (
    <div className="oli-page" style={{ padding: "32px 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1024 }}>
      <header>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-quaternary)" }}>
          MPP Service
        </span>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 40, fontWeight: 400, margin: "4px 0 8px" }}>
          {detail.head.label}
        </h1>
        <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, margin: 0 }}>
          {detail.head.bio ?? ""}
        </p>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          settlement <code>{shortAddress(detail.head.wallets?.[0] ?? "")}</code>
        </div>
      </header>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Revenue trend · 30 days
        </h2>
        <TrendChart
          points={trendPoints}
          formatY={(v) => `$${v.toFixed(2)}`}
        />
      </section>

      <section>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
          Recent activity
        </h2>
        <EventStream events={detail.recent as never} labelMap={labelMap} />
      </section>
    </div>
  );
}
