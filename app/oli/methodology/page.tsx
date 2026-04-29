import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Pellet OLI decodes autonomous economic activity on Tempo — event ingestion, agent matching, gateway attribution.",
};

export default function MethodologyPage() {
  return (
    <div
      className="oli-page oli-methodology"
      style={{
        padding: "32px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 760,
      }}
    >
      <header>
        <span className="oli-meth-kicker">Reference</span>
        <h1 className="oli-meth-h1">Methodology</h1>
        <p className="oli-meth-lede">
          How OLI decodes autonomous economic activity on Tempo. Every datapoint
          on this site comes from on-chain state — no off-chain sources, no
          self-reporting. The pipeline is open and reproducible.
        </p>
      </header>

      <Section
        n="01"
        title="Event ingestion"
        version="cron @ :00 hourly"
      >
        <p>
          A Vercel cron at <Mono>/api/cron/ingest</Mono> sweeps Tempo for new
          logs from watched contracts (TIP-20 stables) using viem against{" "}
          <Mono>rpc.tempo.xyz</Mono>. Logs are stored raw in the{" "}
          <Mono>events</Mono> table, keyed by{" "}
          <Mono>(tx_hash, log_index)</Mono> for idempotency.
        </p>
        <p>
          We watch the <code>Transfer</code> event (topic{" "}
          <Mono>0xddf252ad…</Mono>) plus a few admin events (Approval, Role*,
          SupplyCapUpdated). Tempo's stable-native AA tx envelope (type{" "}
          <Mono>0x76</Mono>) is parsed by reading <code>tx.calls[]</code>{" "}
          rather than the standard <code>tx.input</code> field.
        </p>
      </Section>

      <Section
        n="02"
        title="Agent matching"
        version="methodology v0.2"
      >
        <p>
          A second cron at <Mono>/api/cron/match</Mono> joins ingested events
          to <Mono>agents</Mono> rows by walking the event's indexed topics
          and looking for a wallet hit. One agent_event row is written per{" "}
          <code>(event, matched agent)</code> pair — the same event can match
          multiple agents (e.g. both sides of a Transfer if both are watched).
        </p>
        <p>
          Each match captures the economic primitive:{" "}
          <Mono>amount_wei</Mono> from the Transfer's data field,{" "}
          <Mono>token_address</Mono> from the contract, and{" "}
          <Mono>counterparty_address</Mono> from whichever indexed topic isn't
          the matched agent.
        </p>
      </Section>

      <Section n="03" title="Gateway attribution" version="cron @ :10 hourly">
        <p>
          The Tempo MPP Gateway settles to a single address (
          <Mono>0xca4e835f…4779Fe</Mono>) for many underlying providers, so
          per-service attribution requires extra decoding. A third cron at{" "}
          <Mono>/api/cron/attribute</Mono> walks unprocessed gateway txs and
          tries two paths.
        </p>

        <SubSection title="Pattern A · Settlement event">
          <p>
            When the gateway routes funds onward to a provider, its escrow
            contract <Mono>0x33b9…4f25</Mono> emits a custom event keyed at
            topic <Mono>0x92ed5fe0…</Mono>. The provider address sits at{" "}
            <code>topic[2]</code>. We read the tx receipt, find the matching
            log, and persist <Mono>routed_to_address</Mono>.
          </p>
          <p style={{ color: "var(--color-text-quaternary)", fontSize: 12 }}>
            Coverage: ~9% of gateway txs. The rest don't go through the
            settlement path because the user paid the gateway directly and
            the gateway batches settlement off-cycle.
          </p>
        </SubSection>

        <SubSection title="Pattern B · Calldata fingerprint">
          <p>
            User→gateway txs use the USDC.e <Mono>0x95777d59</Mono> selector
            with args <Mono>(address recipient, uint256 amount, bytes32 ref)</Mono>.
            The <Mono>bytes32 ref</Mono> has stable structure:
          </p>
          <pre className="oli-meth-pre">
            0xef1ed71201 + {"<10-byte service fingerprint>"} +
            {"\n             "}
            0000000000000000 + {"<7-byte per-call nonce>"}
          </pre>
          <p>
            Bytes 5–14 are a deterministic per-service fingerprint set by
            Tempo's MPP client. We persist them as{" "}
            <Mono>routed_fingerprint</Mono> so all gateway txs cluster by
            service even when the provider address can't be recovered.
          </p>
          <p style={{ color: "var(--color-text-quaternary)", fontSize: 12 }}>
            Coverage: ~91% of gateway txs (combined with Pattern A:
            essentially 100%). Fingerprints aren't human-readable until a
            row is added to <Mono>address_labels</Mono> mapping the
            fingerprint to a model name; the UI lights up automatically once
            it's there.
          </p>
        </SubSection>
      </Section>

      <Section n="04" title="Provenance">
        <p>
          Every row in OLI carries a <Mono>methodology_version</Mono> tag
          plus a <Mono>source_block</Mono> reference. The ringed ◍ badge
          throughout the UI exposes both. Re-deriving any number is a matter
          of running the matcher against the raw <Mono>events</Mono> table —
          no opaque steps, no off-chain inputs.
        </p>
        <p>
          Time windows on the dashboard (<Mono>?w=24h|7d|30d|all</Mono>) are
          also surfaced; every leaderboard, chart, and aggregate is derived
          from the same SQL filter.
        </p>
      </Section>

      <Section n="05" title="What's not yet decoded">
        <ul className="oli-meth-list">
          <li>
            Provider identities for the 2 attributed addresses (
            <Mono>0xc95c4f0d…</Mono>, <Mono>0x3fee0b02…</Mono>) and 7
            fingerprint groups. These are stable on-chain — only labels are
            missing.
          </li>
          <li>
            Non-MPP services (the long tail we couldn't probe at seed time).
          </li>
          <li>
            Cross-tx flow tracing (e.g., a payer's fund-out path through
            multiple hops).
          </li>
        </ul>
      </Section>

      <p className="oli-meth-foot">
        Source: the{" "}
        <a href="https://github.com/pelletnetwork/pellet" className="oli-meth-link">
          pelletnetwork/pellet
        </a>{" "}
        repo on GitHub. SQL lives in <Mono>lib/oli/queries.ts</Mono>;
        attribution lives in <Mono>lib/ingest/gateway-attribution.ts</Mono>.
      </p>
    </div>
  );
}

function Section({
  n,
  title,
  version,
  children,
}: {
  n: string;
  title: string;
  version?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="oli-meth-section">
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          paddingBottom: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <span className="oli-meth-section-n">{n}</span>
        <h2 className="oli-meth-h2">{title}</h2>
        {version && <span className="oli-meth-version">{version}</span>}
      </header>
      <div className="oli-meth-body">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, paddingLeft: 16, borderLeft: "1px solid var(--color-border-subtle)" }}>
      <h3 className="oli-meth-h3">{title}</h3>
      {children}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="oli-meth-mono">{children}</code>;
}
