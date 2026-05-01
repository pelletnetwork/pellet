import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Specimen / Wallet",
};

const SIGNED_PAYMENTS = [
  { when: "02s ago", tx: "0xa14e…7c2b", memo: "x402:codex/run-9e2a", svc: "Codex", session: "cli-mac", amount: "$0.014 USDC.e", status: "[ OK ]" },
  { when: "38m ago", tx: "0x77b9…3140", memo: "mpp:gateway/route/812", svc: "MPP Gateway", session: "cli-mac", amount: "$2.41 USDC.e", status: "[ OK ]" },
  { when: "2h ago", tx: "0xc302…ab14", memo: "x402:stargate/swap-44ef", svc: "Stargate", session: "cli-mac", amount: "$8.75 USDC.e", status: "[ OK ]" },
  { when: "5h ago", tx: "0x9eb6…dd02", memo: "x402:codex/run-2c14", svc: "Codex", session: "mcp-srv", amount: "$0.022 USDC.e", status: "[ OK ]" },
  { when: "9h ago", tx: "0x4f1a…6e98", memo: "mpp:gateway/route/812", svc: "MPP Gateway", session: "cli-mac", amount: "$1.06 USDT0", status: "[ OK ]" },
  { when: "14h ago", tx: "0x2da7…01b3", memo: "x402:codex/run-71d8", svc: "Codex", session: "cli-mac", amount: "$0.018 USDC.e", status: "[ OK ]" },
  { when: "1d ago", tx: "0xb88c…f724", memo: "x402:enshrined/quote-5b", svc: "Enshrined DEX", session: "mcp-srv", amount: "$3.18 USDC.e", status: "[ OK ]" },
  { when: "2d ago", tx: "0x05fe…9c40", memo: "mpp:gateway/route/812", svc: "MPP Gateway", session: "cli-mac", amount: "$5.92 USDC.e", status: "[ OK ]" },
];

function PageHeader() {
  return (
    <section className="spec-page-header">
      <div className="spec-page-header-row">
        <h1 className="spec-page-title">
          <span>07</span>
          <span>Pellet Wallet</span>
          <span className="spec-page-title-em">— main</span>
        </h1>
        <div className="spec-switch" role="group" aria-label="Wallet actions">
          <button type="button" className="spec-switch-seg">PAIR DEVICE</button>
          <button type="button" className="spec-switch-seg">EXPORT</button>
          <button type="button" className="spec-switch-seg spec-switch-seg-active">SIGN</button>
        </div>
      </div>
      <div className="spec-page-subhead">
        <span className="spec-page-subhead-label">ADDR</span>
        <span>0x4e7c·9b3a·d11f·2845·c6e0·77ab·1290·4f8a·a1b9</span>
        <span className="spec-page-subhead-dot">·</span>
        <span className="spec-page-subhead-label">PASSKEY</span>
        <span>iCloud · MacBook Pro · jakemaynard90</span>
        <span className="spec-page-subhead-dot">·</span>
        <span className="spec-page-subhead-label">PAIRED</span>
        <span>2 devices</span>
      </div>
    </section>
  );
}

function BalanceStrip() {
  return (
    <section className="spec-strip">
      <div className="spec-strip-cell" style={{ flex: "1.4 1 0" }}>
        <span className="spec-strip-label">TOTAL BALANCE</span>
        <span className="spec-strip-value spec-strip-value-lg">$1,247.83</span>
        <span className="spec-strip-sub" style={{ flexDirection: "row", gap: 18 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="spec-legend-square spec-legend-square-filled" />
            <span>USDC.e $1,114.20</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="spec-legend-square spec-legend-square-outline" />
            <span>USDT0 $133.63</span>
          </span>
        </span>
      </div>
      <div className="spec-strip-cell">
        <span className="spec-strip-label">SENT · 30D</span>
        <span className="spec-strip-value spec-strip-value-md">$83.42</span>
        <span className="spec-strip-sub">
          <span>14 settlements</span>
          <span className="spec-strip-sub-faint">avg $5.96</span>
        </span>
      </div>
      <div className="spec-strip-cell">
        <span className="spec-strip-label">SESSION KEYS</span>
        <span className="spec-strip-value spec-strip-value-md">2 / 3</span>
        <span className="spec-strip-sub">
          <span>active out of 3 max</span>
        </span>
      </div>
      <div className="spec-strip-cell">
        <span className="spec-strip-label">PAIRED DEVICES</span>
        <span className="spec-strip-value spec-strip-value-md">2</span>
        <span className="spec-strip-sub">
          <span>iPhone 16 Pro · MBP M3</span>
        </span>
      </div>
    </section>
  );
}

function ActivityColumn() {
  return (
    <div className="spec-col-activity">
      <div className="spec-col-head">
        <span className="spec-col-head-left">SIGNED PAYMENTS · 7D</span>
        <span className="spec-col-head-right">
          <span><span style={{ opacity: 0.55 }}>COUNT</span> 14</span>
          <span><span style={{ opacity: 0.55 }}>FILTER</span> all · all</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="spec-legend-square spec-legend-square-filled" />
            <span>STREAMING</span>
          </span>
        </span>
      </div>
      <div className="spec-activity-head">
        <span style={{ width: 86, flexShrink: 0 }}>WHEN</span>
        <span style={{ width: 100, flexShrink: 0 }}>TX</span>
        <span style={{ flex: 1, minWidth: 0 }}>MEMO / SERVICE</span>
        <span style={{ width: 80, flexShrink: 0 }} className="spec-cell-r">SESSION</span>
        <span style={{ width: 110, flexShrink: 0 }} className="spec-cell-r">AMOUNT</span>
        <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">STATUS</span>
      </div>
      {SIGNED_PAYMENTS.map((row, i) => (
        <div key={i} className="spec-activity-row">
          <span style={{ width: 86, flexShrink: 0 }}>{row.when}</span>
          <span style={{ width: 100, flexShrink: 0 }}>{row.tx}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.memo} · {row.svc}
          </span>
          <span style={{ width: 80, flexShrink: 0, opacity: 0.7 }} className="spec-cell-r">{row.session}</span>
          <span style={{ width: 110, flexShrink: 0 }} className="spec-cell-r">{row.amount}</span>
          <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">{row.status}</span>
        </div>
      ))}
    </div>
  );
}

function SessionCard({
  name,
  rows,
}: {
  name: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="spec-session-card">
      <div className="spec-session-top">
        <span style={{ fontSize: 13 }}>{name}</span>
        <span className="spec-pill">[ACTIVE]</span>
      </div>
      <div className="spec-meta-grid">
        {rows.map(([k, v]) => (
          <span key={k} style={{ display: "contents" }}>
            <span className="spec-meta-label">{k}</span>
            <span>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RightRail() {
  return (
    <div className="spec-col-rail">
      <div className="spec-col-head">
        <span className="spec-col-head-left">ACTIVE SESSION KEYS</span>
        <span className="spec-col-head-right">
          <span><span style={{ opacity: 0.55 }}>QUOTA</span> 2 / 3</span>
        </span>
      </div>
      <SessionCard
        name="cli-mac"
        rows={[
          ["issued", "2026-04-26 14:08 UTC"],
          ["expires", "2026-05-26 14:08 UTC"],
          ["scope", "send · max $50/tx · max $200/d"],
          ["used", "$83.42 · 14 tx"],
        ]}
      />
      <SessionCard
        name="mcp-srv"
        rows={[
          ["issued", "2026-04-29 03:22 UTC"],
          ["expires", "2026-05-29 03:22 UTC"],
          ["scope", "send · max $10/tx · memo:x402:*"],
          ["used", "$3.20 · 2 tx"],
        ]}
      />
      <button type="button" className="spec-issue-new">
        <span className="spec-keycap" aria-hidden="true">+</span>
        <span>ISSUE NEW SESSION</span>
      </button>
      <div className="spec-col-head" style={{ marginTop: 14, borderBottom: "none" }}>
        <span className="spec-col-head-left">PENDING APPROVAL</span>
        <span className="spec-col-head-right">
          <span><span style={{ opacity: 0.55 }}>COUNT</span> 1</span>
        </span>
      </div>
      <div className="spec-pending-card">
        <div className="spec-pending-top">
          <span style={{ fontSize: 13 }}>Codex · run-7c0e</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>expires in 04:21</span>
        </div>
        <div className="spec-meta-grid spec-meta-grid-wide">
          <span style={{ display: "contents" }}>
            <span className="spec-meta-label">amount</span>
            <span>$0.014 USDC.e</span>
          </span>
          <span style={{ display: "contents" }}>
            <span className="spec-meta-label">memo</span>
            <span>x402:codex/run-7c0e</span>
          </span>
          <span style={{ display: "contents" }}>
            <span className="spec-meta-label">to</span>
            <span>0x91bb…22a3</span>
          </span>
        </div>
        <div className="spec-pending-actions">
          <button type="button" className="spec-pending-btn">REJECT</button>
          <button type="button" className="spec-pending-btn spec-pending-btn-primary">APPROVE</button>
        </div>
      </div>
    </div>
  );
}

function MainCols() {
  return (
    <section className="spec-cols">
      <ActivityColumn />
      <RightRail />
    </section>
  );
}

export default function SpecimenWallet() {
  return (
    <>
      <PageHeader />
      <BalanceStrip />
      <MainCols />
    </>
  );
}
