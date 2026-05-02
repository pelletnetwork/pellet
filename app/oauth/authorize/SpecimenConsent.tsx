"use client";

import { useState } from "react";

type ScopeDisplay = { name: string; description: string };

export function SpecimenConsent({
  clientName,
  clientId,
  redirectUri,
  audience,
  scopes,
  state,
  codeChallenge,
  codeChallengeMethod,
}: {
  clientName: string;
  clientId: string;
  redirectUri: string;
  audience: string;
  scopes: ScopeDisplay[];
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
}) {
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: "approve" | "deny") {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          clientId,
          redirectUri,
          audience,
          scopes: scopes.map((s) => s.name),
          state,
          codeChallenge,
          codeChallengeMethod,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      const data = (await res.json()) as { redirectUri: string };
      window.location.href = data.redirectUri;
    } catch (err) {
      setSubmitting(null);
      setError(err instanceof Error ? err.message : "submission failed");
    }
  }

  let clientOrigin: string;
  try {
    clientOrigin = new URL(clientId).origin;
  } catch {
    clientOrigin = clientId;
  }

  return (
    <section className="spec-oauth-card">
      <h1 className="spec-oauth-title">authorize agent</h1>
      <p className="spec-oauth-lede">
        <span className="spec-oauth-client">{clientName}</span>{" "}
        wants access to your Pellet wallet.
      </p>

      <dl className="spec-oauth-meta">
        <dt>FROM</dt>
        <dd className="spec-oauth-mono">{clientOrigin}</dd>
        <dt>WILL CALL</dt>
        <dd className="spec-oauth-mono">{audience}</dd>
        <dt>RETURNS TO</dt>
        <dd className="spec-oauth-mono">{redirectUri}</dd>
      </dl>

      <h2 className="spec-oauth-subhead">PERMISSIONS REQUESTED</h2>
      <ul className="spec-oauth-scopes">
        {scopes.map((s) => (
          <li key={s.name}>
            <span className="spec-oauth-scope-name">{s.name}</span>
            <span className="spec-oauth-scope-desc">{s.description}</span>
          </li>
        ))}
      </ul>

      <div className="spec-oauth-actions">
        <button
          type="button"
          className="spec-oauth-btn spec-oauth-btn-deny"
          disabled={submitting !== null}
          onClick={() => void submit("deny")}
        >
          {submitting === "deny" ? "…" : "DENY"}
        </button>
        <button
          type="button"
          className="spec-oauth-btn spec-oauth-btn-approve"
          disabled={submitting !== null}
          onClick={() => void submit("approve")}
        >
          {submitting === "approve" ? "…" : "APPROVE"}
        </button>
      </div>

      {error && (
        <p className="spec-oauth-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
