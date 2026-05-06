"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WalletTabs } from "@/components/oli/WalletTabs";

type Agent = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: "cimd" | "pre" | "dynamic";
  scopes: string[];
  connectedAt: string;
  lastSeenAt: string;
  tokenExpiresAt: string | null;
  tokenState: "active" | "expired" | "revoked" | "missing";
  activeTokenCount: number;
  webhookEnabled: boolean;
};

type Session = {
  id: string;
  label: string | null;
  spendCapWei: string;
  spendUsedWei: string;
  perCallCapWei: string;
  expiresAt: string;
  revokedAt: string | null;
  authorizeTxHash: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  sessionId: string;
  recipient: string;
  amountWei: string;
  txHash: string | null;
  status: string;
  createdAt: string;
};

function fmtAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtUntil(iso: string | null): string {
  if (!iso) return "none";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

function fmtUsd(n: number, max = 2): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })}`;
}

function clientTypeLabel(t: Agent["clientType"]): string {
  if (t === "dynamic") return "DCR";
  if (t === "cimd") return "CIMD";
  return "PRE";
}

function sessionState(s: Session): "active" | "pending" | "expired" | "revoked" {
  if (s.revokedAt) return "revoked";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "expired";
  if (!s.authorizeTxHash) return "pending";
  return "active";
}

function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function SpecimenConnectedAgents({
  basePath,
  agents,
  sessions,
  payments,
}: {
  basePath: string;
  agents: Agent[];
  sessions: Session[];
  payments: Payment[];
}) {
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => agents.filter((a) => !revoked.has(a.id)),
    [agents, revoked],
  );

  const activeSessions = useMemo(
    () => sessions.filter((s) => sessionState(s) === "active"),
    [sessions],
  );

  const recentPayments = useMemo(
    () => payments.slice(0, 10),
    [payments],
  );

  async function revokeAgent(agentId: string) {
    setRevoking((prev) => new Set(prev).add(agentId));
    setError(null);
    try {
      const res = await fetch(`/api/wallet/agents/${agentId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      setRevoked((prev) => new Set(prev).add(agentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "revoke failed");
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  }

  async function revokeSession(sessionId: string) {
    setRevoking((prev) => new Set(prev).add(sessionId));
    setError(null);
    try {
      const res = await fetch(`/api/wallet/sessions/${sessionId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      setRevoked((prev) => new Set(prev).add(sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "revoke failed");
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }

  return (
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Wallet · Agents</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">CONNECTED</span>
          <span>{visible.length}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">KEYS</span>
          <span>{activeSessions.length} active</span>
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="spec-agents-empty">
          <h2 className="spec-agents-empty-head">no agents connected</h2>
          <p className="spec-agents-empty-hint">
            Add Pellet to your AI client to grant it wallet access.
            Walk through the connection cards at{" "}
            <Link href={`${basePath}/onboard`}>Connect</Link>, or read the
            full setup at <Link href="/mcp-docs">the MCP guide</Link>.
          </p>
        </section>
      ) : (
        <>
          {/* ── Identity ──────────────────────────────────── */}
          {visible.map((a) => (
            <div key={a.id} className="spec-agent-detail-card">
              <div className="spec-agent-detail-top">
                <div className="spec-agent-detail-name">
                  <span className="spec-agent-detail-title">{a.clientName.replace(/\s*\(.*\)$/, "")}</span>
                  <span className="spec-agent-detail-meta">
                    <span className={`spec-agents-tag spec-agents-tag-${a.clientType}`}>
                      {clientTypeLabel(a.clientType)}
                    </span>
                    <span className="spec-faint">{a.clientId.slice(0, 24)}{a.clientId.length > 24 ? "…" : ""}</span>
                  </span>
                </div>
                <div className="spec-agent-detail-status">
                  <span className={`spec-agents-token-state spec-agents-token-state-${a.tokenState}`}>
                    {a.tokenState}
                  </span>
                  <button
                    type="button"
                    className="spec-agents-revoke"
                    disabled={revoking.has(a.id)}
                    onClick={() => void revokeAgent(a.id)}
                  >
                    {revoking.has(a.id) ? "…" : "REVOKE"}
                  </button>
                </div>
              </div>
              <div className="spec-agent-detail-grid">
                <span className="spec-meta-label">scopes</span>
                <span>{a.scopes.map((s) => s.replace(/^wallet:/, "")).join(" · ")}</span>
                <span className="spec-meta-label">connected</span>
                <span>{fmtAgo(a.connectedAt)}</span>
                <span className="spec-meta-label">last seen</span>
                <span>{fmtAgo(a.lastSeenAt)}</span>
                <span className="spec-meta-label">token</span>
                <span>{fmtUntil(a.tokenExpiresAt)}</span>
                <span className="spec-meta-label">transport</span>
                <span>{a.webhookEnabled ? "webhook" : "poll"}</span>
              </div>
            </div>
          ))}

          {/* ── Session Keys ──────────────────────────────── */}
          <div className="spec-page-subhead" style={{ paddingTop: 4, paddingLeft: 8 }}>
            <span className="spec-page-subhead-label">SESSION KEYS</span>
            <span>{activeSessions.filter((s) => !revoked.has(s.id)).length} / {sessions.length}</span>
            <span className="spec-page-subhead-dot">·</span>
            <span className="spec-page-subhead-label">ACTIVE</span>
            <span>{activeSessions.filter((s) => !revoked.has(s.id)).length}</span>
          </div>

          {activeSessions.filter((s) => !revoked.has(s.id)).length === 0 ? (
            <div style={{ padding: "20px 0", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
              No active session keys.
            </div>
          ) : (
            activeSessions.filter((s) => !revoked.has(s.id)).map((s) => {
              const cap = Number(s.spendCapWei) / 1_000_000;
              const used = Number(s.spendUsedWei) / 1_000_000;
              const perCall = Number(s.perCallCapWei) / 1_000_000;
              const remaining = Math.max(0, cap - used);
              const usage = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
              return (
                <div key={s.id} className="spec-session-card">
                  <div className="spec-session-top">
                    <span className="spec-session-name-stack">
                      <Link href={`${basePath}/dashboard/sessions/${s.id}`}>
                        {s.label ?? s.id.slice(0, 8)}
                      </Link>
                    </span>
                    <span className="spec-pill">[ ACTIVE ]</span>
                  </div>
                  <div className="spec-session-usage">
                    <div className="spec-session-usage-row">
                      <span>{fmtUsd(remaining, 4)} remaining</span>
                      <span>{usage.toFixed(0)}% used</span>
                    </div>
                    <div className="spec-session-progress" aria-hidden="true">
                      <span style={{ width: `${usage}%` }} />
                    </div>
                  </div>
                  <div className="spec-meta-grid">
                    <span className="spec-meta-label">issued</span>
                    <span>{fmtAgo(s.createdAt)}</span>
                    <span className="spec-meta-label">expires</span>
                    <span>{fmtUntil(s.expiresAt)}</span>
                    <span className="spec-meta-label">per call</span>
                    <span>≤ {fmtUsd(perCall, 4)} / call</span>
                    <span className="spec-meta-label">total cap</span>
                    <span>{fmtUsd(used, 4)} / {fmtUsd(cap)}</span>
                  </div>
                  <div style={{ alignSelf: "flex-end" }}>
                    <button
                      type="button"
                      className="spec-agents-revoke"
                      disabled={revoking.has(s.id)}
                      onClick={() => void revokeSession(s.id)}
                    >
                      {revoking.has(s.id) ? "…" : "REVOKE"}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <Link
            href={`${basePath}/dashboard/sessions`}
            className="spec-issue-new"
            style={{ marginTop: 0 }}
          >
            <span className="spec-keycap" aria-hidden="true">+</span>
            <span>ISSUE NEW KEY</span>
          </Link>

          {/* ── Activity ──────────────────────────────────── */}
          <div className="spec-page-subhead" style={{ paddingTop: 4, paddingLeft: 8 }}>
            <span className="spec-page-subhead-label">RECENT ACTIVITY</span>
            <span>{payments.length} total</span>
          </div>

          {recentPayments.length === 0 ? (
            <div style={{ padding: "20px 0", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
              No activity yet.
            </div>
          ) : (
            recentPayments.map((p) => (
              <div key={p.id} className="spec-activity-row">
                <div className="spec-activity-head" style={{ padding: 0 }}>
                  <span style={{ flex: 1 }}>{shortAddr(p.recipient)}</span>
                  <span>{fmtUsd(Number(p.amountWei) / 1_000_000)}</span>
                  <span className={`spec-status-pill spec-status-pill-${p.status === "confirmed" ? "ok" : "pending"}`}>
                    {p.status}
                  </span>
                  <span style={{ opacity: 0.55, minWidth: 60, textAlign: "right" }}>{fmtAgo(p.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {error && (
        <p className="spec-agents-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
