"use client";

import { useState } from "react";
import Link from "next/link";

type CardStatus = "live" | "guide" | "soon";

type AgentCard = {
  id: string;
  name: string;
  group: "subscription" | "local" | "custom";
  status: CardStatus;
  blurb: string;
  // For 'live' clients: a one-line install command + a config snippet.
  install?: { command?: string; config?: string };
};

function buildCards(mcpUrl: string): AgentCard[] {
  return [
    // Subscription agents — most users have one of these already
    {
      id: "claude-ai",
      name: "Claude.ai",
      group: "subscription",
      status: "live",
      blurb:
        "Pro/Team. Settings → Connectors → Add. Paste the URL below; OAuth runs in browser.",
      install: { config: mcpUrl },
    },
    {
      id: "chatgpt",
      name: "ChatGPT",
      group: "subscription",
      status: "live",
      blurb:
        "Pro/Team. Settings → Connectors → Add. Paste the URL; OAuth runs in browser.",
      install: { config: mcpUrl },
    },
    {
      id: "gemini",
      name: "Gemini",
      group: "subscription",
      status: "soon",
      blurb: "Native MCP support is rolling out — get notified when live.",
    },

    // Local / developer agents
    {
      id: "claude-code",
      name: "Claude Code",
      group: "local",
      status: "live",
      blurb: "Native MCP. One command in your terminal.",
      install: {
        command: `claude mcp add pellet --transport http ${mcpUrl}`,
      },
    },
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      group: "local",
      status: "live",
      blurb: "Settings → Connectors → Add Connector → paste the URL.",
      install: { config: mcpUrl },
    },
    {
      id: "cursor",
      name: "Cursor",
      group: "local",
      status: "live",
      blurb: "Add to ~/.cursor/mcp.json:",
      install: {
        config: JSON.stringify(
          {
            mcpServers: {
              pellet: { url: mcpUrl },
            },
          },
          null,
          2,
        ),
      },
    },
    {
      id: "codex",
      name: "Codex / OpenCode",
      group: "local",
      status: "live",
      blurb: "Same shape as Claude Code:",
      install: {
        command: `codex mcp add pellet --transport http ${mcpUrl}`,
      },
    },

    // Custom backends
    {
      id: "custom",
      name: "Custom backend",
      group: "custom",
      status: "guide",
      blurb:
        "Build your own MCP client + register a webhook for user replies. See the docs.",
    },
  ];
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="spec-onboard-copy"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      title="Copy to clipboard"
    >
      {copied ? "COPIED" : label}
    </button>
  );
}

function StatusPill({ status }: { status: CardStatus }) {
  const labels: Record<CardStatus, string> = {
    live: "LIVE",
    guide: "GUIDE",
    soon: "COMING",
  };
  return (
    <span className={`spec-onboard-pill spec-onboard-pill-${status}`}>
      {labels[status]}
    </span>
  );
}

function Card({ card }: { card: AgentCard }) {
  return (
    <div className={`spec-onboard-card spec-onboard-card-${card.status}`}>
      <header className="spec-onboard-card-head">
        <span className="spec-onboard-card-name">{card.name}</span>
        <StatusPill status={card.status} />
      </header>
      <p className="spec-onboard-card-blurb">{card.blurb}</p>
      {card.install?.command && (
        <div className="spec-onboard-snippet spec-onboard-snippet-shell">
          <code>{card.install.command}</code>
          <CopyButton value={card.install.command} />
        </div>
      )}
      {card.install?.config && !card.install.command && (
        <div className="spec-onboard-snippet">
          <code>
            {card.install.config.length > 80
              ? card.install.config.slice(0, 80) + "…"
              : card.install.config}
          </code>
          <CopyButton value={card.install.config} />
        </div>
      )}
      {card.status === "guide" && (
        <Link className="spec-onboard-card-link" href="/oli/mcp">
          See setup guide →
        </Link>
      )}
    </div>
  );
}

export function SpecimenOnboardConnect({
  basePath,
  mcpUrl,
  connectedCount,
}: {
  basePath: string;
  mcpUrl: string;
  connectedCount: number;
}) {
  const cards = buildCards(mcpUrl);

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>02</span>
            <span>Wallet · Connect your agent</span>
          </h1>
          <Link
            href={`${basePath}/dashboard`}
            className="spec-onboard-skip"
            title="Skip — go to your wallet dashboard"
          >
            {connectedCount > 0 ? "DASHBOARD →" : "SKIP →"}
          </Link>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">CONNECTED</span>
          <span>{connectedCount}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span>
            {connectedCount === 0
              ? "Bring your AI to your wallet."
              : "Add another agent or jump to the dashboard."}
          </span>
        </div>
      </section>

      <section className="spec-onboard-shell">
        <h2 className="spec-onboard-group-head">
          <span>USE YOUR EXISTING AI SUBSCRIPTION</span>
        </h2>
        <div className="spec-onboard-grid">
          {cards
            .filter((c) => c.group === "subscription")
            .map((c) => (
              <Card key={c.id} card={c} />
            ))}
        </div>

        <h2 className="spec-onboard-group-head">
          <span>LOCAL OR DEVELOPER AGENTS</span>
        </h2>
        <div className="spec-onboard-grid">
          {cards
            .filter((c) => c.group === "local")
            .map((c) => (
              <Card key={c.id} card={c} />
            ))}
        </div>

        <h2 className="spec-onboard-group-head">
          <span>CUSTOM</span>
        </h2>
        <div className="spec-onboard-grid">
          {cards
            .filter((c) => c.group === "custom")
            .map((c) => (
              <Card key={c.id} card={c} />
            ))}
        </div>

        <p className="spec-onboard-foot">
          Full setup walkthroughs at{" "}
          <Link href="/oli/mcp">/oli/mcp</Link>. Manage connected agents at{" "}
          <Link href={`${basePath}/dashboard/agents`}>your agents page</Link>.
        </p>
      </section>
    </>
  );
}
