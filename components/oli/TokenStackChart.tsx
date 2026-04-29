import { TOKEN_COLORS, type TokenBucket } from "@/lib/oli/tokens";
import type { TokenStackPoint, TokenStackTotals } from "@/lib/oli/queries";

const ORDER: TokenBucket[] = ["USDC.e", "USDT0", "other"];
const KEY: Record<TokenBucket, "usdce" | "usdt0" | "other"> = {
  "USDC.e": "usdce",
  USDT0: "usdt0",
  other: "other",
};

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

export function TokenStackChart({
  points,
  totals,
  height = 140,
}: {
  points: TokenStackPoint[];
  totals: TokenStackTotals;
  height?: number;
}) {
  const grandTotal = totals.usdce + totals.usdt0 + totals.other;

  if (points.length < 2 || grandTotal === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--color-text-quaternary)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          background: "var(--color-bg-subtle)",
        }}
      >
        not enough data yet
      </div>
    );
  }

  const W = 800;
  const H = height;
  const padT = 12, padB = 16, padL = 0, padR = 0;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const totalsPerBucket = points.map((p) => p.usdce + p.usdt0 + p.other);
  const yMax = Math.max(...totalsPerBucket) || 1;

  const xFor = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) => padT + ((yMax - v) / yMax) * innerH;

  // Build cumulative stack values: for each bucket, [usdce, usdce+usdt0, usdce+usdt0+other]
  const stacks = points.map((p) => ({
    usdce: p.usdce,
    usdt0: p.usdce + p.usdt0,
    other: p.usdce + p.usdt0 + p.other,
  }));

  // Build a polygon for each layer: top edge is the cumulative-up-to-and-incl,
  // bottom edge is cumulative-up-to-prior-layer. Layers stack visually USDC.e
  // on the bottom (closest to baseline), then USDT0, then other on top.
  const layerPath = (layer: TokenBucket): string => {
    const top = stacks.map((s, i) => {
      const v = layer === "USDC.e" ? s.usdce : layer === "USDT0" ? s.usdt0 : s.other;
      return `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`;
    });
    const bottom = stacks.map((s, i) => {
      const v =
        layer === "USDC.e" ? 0 : layer === "USDT0" ? s.usdce : s.usdt0;
      return `${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`;
    });
    return `M ${top.join(" L ")} L ${bottom.reverse().join(" L ")} Z`;
  };

  return (
    <div className="oli-tokenstack" style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
        <line
          x1={0}
          x2={W}
          y1={H - padB}
          y2={H - padB}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={1}
        />
        {ORDER.map((layer) => (
          <path
            key={layer}
            d={layerPath(layer)}
            fill={TOKEN_COLORS[layer]}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.5}
          />
        ))}
      </svg>

      <div className="oli-tokenstack-legend">
        {ORDER.map((layer) => {
          const v = totals[KEY[layer]];
          const pct = grandTotal > 0 ? (v / grandTotal) * 100 : 0;
          return (
            <div key={layer} className="oli-tokenstack-legend-item">
              <span
                className="oli-tokenstack-swatch"
                style={{ background: TOKEN_COLORS[layer] }}
                aria-hidden="true"
              />
              <span className="oli-tokenstack-legend-label">{layer}</span>
              <span className="oli-tokenstack-legend-value">{fmtUsd(v)}</span>
              <span className="oli-tokenstack-legend-pct">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
