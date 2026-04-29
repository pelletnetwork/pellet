type Point = { ts: Date; value: number };

export function TrendChart({
  points,
  height = 120,
  formatY = (n) => String(n),
}: {
  points: Point[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  if (points.length < 2) {
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
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const ys = points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) => padT + ((yMax - v) / yRange) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(p.value).toFixed(2)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
        <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
        {yMin < 0 && yMax > 0 && (
          <line x1={0} x2={W} y1={yFor(0)} y2={yFor(0)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={1.5} strokeLinecap="square" />
        <circle cx={xFor(points.length - 1)} cy={yFor(last.value)} r={2.5} fill="rgba(255,255,255,0.95)" />
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{formatY(yMin)}</span>
        <span>{formatY(yMax)}</span>
      </div>
    </div>
  );
}
