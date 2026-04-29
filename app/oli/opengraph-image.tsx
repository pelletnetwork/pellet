import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Pellet OLI — Open-Ledger Interface for Tempo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000",
          color: "#fff",
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {/* YInMn accent stripe top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "#2e5090",
          }}
        />

        {/* Header row: P mark + mono kicker */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="4" fill="#fff" />
            <path
              d="M11 9h6.5a4.5 4.5 0 0 1 0 9H13v5h-2V9zm2 2v5h4.5a2.5 2.5 0 0 0 0-5H13z"
              fill="#000"
            />
          </svg>
          <span
            style={{
              fontSize: 18,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            PELLET · OLI
          </span>
        </div>

        {/* Hero: serif headline */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            marginTop: 48,
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 100,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 400,
            }}
          >
            Open-Ledger
            <br />
            Interface
          </div>
        </div>

        {/* Footer: mono tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 18,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.04em",
          }}
        >
          <span>autonomous economic activity on tempo</span>
          <span style={{ color: "#2e5090" }}>pellet.network</span>
        </div>
      </div>
    ),
    size,
  );
}
