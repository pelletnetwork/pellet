# Pellet OLI v0 — MPP-Aware Dashboard

**Spec date:** 2026-04-29 (v3 — supersedes the agentics-terminal framing in `2026-04-29-pellet-oli-design.md` for the v0 implementation surface)
**Author:** Jake Maynard (@pelletnetwork)
**Status:** Approved for implementation planning
**Domain:** pellet.network/oli
**Spec ancestry:** `2026-04-29-pellet-oli-design.md` (the OLI-on-Tempo strategic thesis is unchanged; this spec narrows it to v0 implementation)

---

## 0. The angle

Tempo is a payments blockchain whose central thesis is **MPP — the Machine Payments Protocol** for AI-agent autonomous commerce. 80+ MPP services already integrated (Anthropic, OpenAI, Dune, Alchemy, Browserbase, Modal, Firecrawl, fal.ai, etc.) covering AI / data / compute / web / storage. Tempo's stack also includes TIP-20 stablecoins, an enshrined DEX, fee economics, validators, zones, bridges, compliance — but **MPP is the unique-to-now thing nobody has positioned around as an analytics category.**

Existing Tempo coverage:
- **Block explorer** (`explore.tempo.xyz`) — too low-level
- **Artemis, Allium, Dune, Nansen, Codex** — generic crypto analytics, no MPP lens
- **mpp.dev/services** — service directory only, no aggregate analytics

**The gap is a brand-shaped hole.** Nobody is *the* MPP lens. Pellet OLI v0 takes that position: the canonical interface for understanding autonomous economic activity on Tempo. Methodology-versioned, block-pinned, re-verifiable.

## 1. Product summary

`pellet.network/oli` — a desktop-first, mobile-readable analytics dashboard that decodes Tempo on-chain settlements into human-legible MPP economic activity:

> **"agent_X paid Anthropic 0.003 USDC.e for chat completion — block 17,332,551, methodology v0.1"**

Three sidebar surfaces in v0: Dashboard (overview), Services (MPP service directory + per-service detail), Agents (watched-wallet directory + per-agent detail). The Tempo ecosystem dashboard scope is *deliberately deferred* — stablecoins, bridges, validators, DEX, etc. land in v0.5+.

## 2. Goals

- **Brand:** Become the canonical name for "MPP analytics" before the category gets one. Win the search-result and the bookmark.
- **Differentiation:** Decode raw Tempo Transfer events into MPP-aware economic activity (agent → service flows). The data is public; the *decoding* is the moat.
- **Methodology:** Every claim on the dashboard reproducible from `(sourceBlock, methodologyVersion)`. The OLI provenance discipline applied to MPP.
- **Reach:** Public, no auth. v0 optimizes for X-share virality + Tempo-ecosystem mention pickup. Premium gating (wallet/email) is a v0.5+ move.
- **Aesthetic:** Premium analyst dashboard on both desktop and mobile. Reference: Linear / Plausible / Vercel dashboards — sans-serif, restrained, information-dense, sparse accent green for positive deltas.

## 3. Non-goals (v0)

- **Stablecoin reconciliation, peg charts, issuer activity** — was scoped in v2; deferred to v0.5 alongside the broader Tempo ecosystem expansion.
- **DEX / fee-economics / zone / validator surfaces** — deferred.
- **Bridges (LayerZero, Relay)** — deferred.
- **Real-time / sub-minute liveness** — hourly refresh is the v0 cadence.
- **Auth, accounts, alerts, API access** — all v0.5+.
- **Native mobile app** — responsive web only.
- **Trade-actionable signals** — never. Pellet is not a brokerage.
- **Pellet's own agent personality / behavior loop** — separate downstream design problem.

## 4. Routes + sidebar

```
EXPLORE
  Dashboard           /oli                    (root — aggregate view)
  Services            /oli/services           (MPP service directory)
                      /oli/services/[id]      (per-service detail)
  Agents              /oli/agents             (watched-wallet directory)
                      /oli/agents/[id]        (per-agent detail)
```

**Sidebar shell:** rendered for every `/oli/*` route. The marketing-site `<Nav>` already auto-suppresses on `/oli/*` (per archive convention preserved in current code). The OLI sidebar replaces it.

**Future routes (deferred, not stubbed):**
- `/oli/stablecoins`, `/oli/bridges`, `/oli/validators`, `/oli/dex`, `/oli/settlements` — added incrementally as v0.5 surfaces ship.

## 5. Audience + use cases

### Day-one audiences

- **Crypto-Twitter spectators / agent-curious.** Click from a tweet, see who's paying whom for what, screenshot a leaderboard, share. *Job: entertain + signal expertise.*
- **Tempo ecosystem participants** (builders, MPP service operators, validators, the Tempo team). Check what's happening on chain, watch their service ranking. *Job: operational visibility.*
- **Investors / agent-economy thesis-watchers.** Track the MPP economy size, growth, category mix. *Job: situational awareness.*

### Anti-audience

- Day traders. They go elsewhere.
- Devs needing raw chain data. They have explore.tempo.xyz + RPC.
- Compliance/regulatory analysts. v0 doesn't surface compliance angles (deferred).

## 6. Page designs

### 6.1 Dashboard (`/oli`)

**Hero strip (top):**
| stat | description |
|---|---|
| MPP txs decoded · 24h | total decoded events in last 24h, with delta vs prior 24h |
| Service revenue · 24h | sum of USDC.e flowing to all watched MPP services in last 24h |
| Agents active · 24h | count of distinct watched agent wallets that initiated ≥1 settlement |
| Live block height | from `/api/v1/health`, polled every 6s |

**Service revenue leaderboard (top-left, full-height):**
- Table: rank · service · category · revenue 24h · txs 24h · delta vs prior 24h
- Top 10 by revenue, sorted desc
- Each row clickable → `/oli/services/[id]`

**Top agents by spend (top-right):**
- Table: rank · agent label · spend 24h · txs 24h · top service used · last activity
- Top 10
- Each row clickable → `/oli/agents/[id]`

**Recent decoded events (bottom, full-width):**
- Reverse-chronological stream, ~25 most recent
- Each row: `[time] [agent.label] paid [service.label] [amount] for [inferred-action] · tx [hash6…hash4]`
- Hover reveals `block N · methodology vX` (OLI provenance)
- "View all" link → future `/oli/settlements` (in v0, links to a longer flat list within Dashboard)

### 6.2 Services directory (`/oli/services`)

Sortable, filterable table of all curated MPP services (10 in v0):

| col | description |
|---|---|
| service | name + small icon if available |
| category | AI / Data / Compute / Storage / Web / Social |
| revenue 24h | USDC.e in last 24h |
| revenue 7d | aggregate |
| txs 24h | count |
| agents 7d | distinct payers in last 7d |
| address | settlement address (or aggregator label) |

Filters: category dropdown, time-window toggle (24h / 7d / all). Click → `/oli/services/[id]`.

### 6.3 Service detail (`/oli/services/[id]`)

Per-service page:
- **Hero strip:** service name, category, total revenue all-time, total txs all-time, distinct payers all-time
- **Revenue trend chart:** line chart, 30-day rolling, hourly buckets
- **Top paying agents:** table, top 10 by spend
- **Recent activity:** event stream filtered to this service
- **Decoding methodology block:** human-readable explanation of how revenue is attributed (which contract address, which event topic, methodology version, source-block range)
- **External links:** service URL, category-mate alternatives

### 6.4 Agents directory (`/oli/agents`)

Same shape as Services directory but for watched agent wallets:

| col | description |
|---|---|
| agent | label |
| source | curated / pellet / future: registry:* |
| activity 24h | tx count |
| spend 24h | total USDC.e settled |
| top service | most-used MPP service |
| last activity | timestamp |
| wallet | address |

Click → `/oli/agents/[id]`.

### 6.5 Agent detail (`/oli/agents/[id]`)

Per-agent page:
- **Hero strip:** label, total spend all-time, total txs all-time, distinct services used
- **Spend trend chart:** line, 30-day, hourly
- **Service mix:** pie or bar — % of spend by service category
- **Top services used:** table, ranked
- **Recent activity:** event stream filtered to this agent
- **Wallet info:** address(es), bio, links (X handle, site)

## 7. Data sources + decoding

### 7.1 The decoding problem

MPP settlements arrive on-chain as TIP-20 Transfer events: `agent_address → settlement_address`. The hard work is identifying *which MPP service* the settlement_address belongs to.

**Two address shapes in the wild:**
- **Direct:** services with their own settlement address (likely Allium, Dune, AgentMail, Browserbase, Stable* family, Pinata)
- **Aggregator:** services proxied through Tempo's MPP infrastructure (`*.mpp.tempo.xyz` — Anthropic, OpenAI, Gemini, fal.ai, Modal, Exa) or paywithlocus.com proxy. These probably settle to ONE aggregator address, with per-service identity in calldata or HTTP `Payment-Receipt` headers (off-chain).

### 7.2 v0 strategy

**Curated address map.** Manually probe ~10 services (top of the directory, mix of categories), capture their settlement addresses, populate `address_labels` with `category = 'mpp_service'` + `notes = { service_id, mpp_url, probed_at, methodology_version }`. Same shape as the existing `agents` table seed pattern.

**Aggregator handling for v0:** if multiple services share a settlement address, group them under a meta-service "Tempo MPP Aggregator" in v0 and disambiguate in v0.5 once we have calldata-decoding logic. Worth saying out loud: this is a known v0 limitation that we ship through.

### 7.3 v0 service seed (10 curated)

| # | service | category | reason |
|---|---|---|---|
| 1 | Anthropic | AI | Highest probable volume |
| 2 | OpenAI | AI | Same |
| 3 | Google Gemini | AI | Same |
| 4 | OpenRouter | AI | Multi-model aggregator |
| 5 | Dune | Data | Famous in crypto |
| 6 | Alchemy | Blockchain | Big infra brand |
| 7 | Browserbase | Compute | Hot category |
| 8 | Modal | Compute | Serverless GPU |
| 9 | Firecrawl | Data | Web-scraping bait |
| 10 | fal.ai | AI/Media | Image/video gen |

Plus the 5 existing system entities seeded earlier (Pellet, Stargate USDC bridge, Tether USDT0 mint, TIP-20 factory, Enshrined DEX) — repurposed as "Tempo entities" surface in the dashboard but kept distinct from MPP services.

### 7.4 Data freshness

Hourly cron (`0 * * * *`) for `/api/cron/ingest` + `/api/cron/match`. Pellet observation cron (`0 * * * *` — same time, after match) appends a Pellet-authored event summarizing the hour.

24 wake-ups/day total. Comfortable inside Neon free-tier compute budget (191.9 hr/mo).

### 7.5 OLI provenance

Every event row carries `sourceBlock` + `methodologyVersion` (already in `agent_events` schema). Every aggregate metric on the dashboard exposes its provenance via hover tooltip:

```
revenue · 24h · 1,247 USDC.e
└─ block range 17328099–17332551 · methodology v0.1
```

The methodology version bumps when:
- The address-label map changes
- Decoding logic changes
- A new event kind is added

Old `agent_events` rows retain their original `methodologyVersion` — historic claims stay reproducible.

## 8. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (desktop + mobile)                                 │
│  Next.js 16 App Router · Tailwind v4 · Geist Sans/Mono      │
│  ─ /oli/* routes render OLI shell (no marketing nav)        │
│  ─ /api/v1/health polled every 6s for live block height     │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Vercel Functions (Node runtime)                            │
│  ─ /api/oli/dashboard      (aggregate stats + leaderboards) │
│  ─ /api/oli/services       (services directory)             │
│  ─ /api/oli/services/:id   (per-service detail)             │
│  ─ /api/oli/agents         (agents directory)               │
│  ─ /api/oli/agents/:id     (per-agent detail)               │
│  ─ /api/v1/health          (block height — already exists)  │
│  ─ /api/cron/ingest, match, pellet-tick (already exist)     │
└────────────────────────────┬────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Postgres (Neon) · Drizzle ORM                              │
│  ─ events                  (raw, already exists)            │
│  ─ agent_events            (decoded, already exists)        │
│  ─ agents                  (registry, already exists)       │
│  ─ address_labels          (used for service mapping)       │
│  ─ ingestion_cursors       (already exists)                 │
│  ─ cron_runs               (already exists)                 │
└─────────────────────────────────────────────────────────────┘
                             ↑
┌─────────────────────────────────────────────────────────────┐
│  Hourly cron — already shipped, just re-enable in vercel.json│
│  ─ /api/cron/ingest    (Tempo RPC → events)                 │
│  ─ /api/cron/match     (events → agent_events)              │
│  ─ /api/cron/pellet-tick (Pellet observation)               │
└─────────────────────────────────────────────────────────────┘
```

**~80% of the backend is already shipped from yesterday.** The new code is:
1. The OLI shell + sidebar layout (replaces marketing nav for `/oli/*`)
2. Dashboard / Services / Agents page components
3. Per-service / per-agent detail pages
4. New API endpoints that aggregate + project the existing `events` + `agent_events` data
5. The seed of 10 MPP service addresses into `address_labels`
6. The hourly cron schedule re-enabled

## 9. Aesthetic spec

### 9.1 Reference

User-supplied screenshot: a Linear/Plausible/Vercel-style analytics dashboard on pure black, sans-serif (likely Inter or Geist Sans), restrained borders, sparse green accents.

### 9.2 Tokens (port + extend the existing palette)

Existing tokens carry forward (already in `globals.css`):
- `--color-bg-base: #0a0a0a` (off-black, not pure black — softer for long sessions)
- `--color-bg-subtle: rgba(255,255,255,0.03)`
- `--color-border-subtle/default/emphasis`
- `--color-text-primary/secondary/tertiary/quaternary`
- `--color-success/error/warning`

OLI-specific additions:
- `--color-accent: #c9a96e` (existing muted amber — used sparingly for OLI provenance hover, methodology-version badges)
- `--color-positive-delta` = `--color-success` (#30a46c)
- `--color-negative-delta` = `--color-error` (#e5484d)

### 9.3 Typography

- **Sans (UI):** Geist Sans for all body text, headings, table data. Numeric: `font-variant-numeric: tabular-nums`.
- **Mono (data labels, hex addresses, methodology version):** Geist Mono.
- **Display (rare — large hero stats):** keep Instrument Serif from landing for the "10,662" hero stat treatment if applicable.

### 9.4 Layout components

- **Sidebar:** 240px fixed-width on desktop. Collapses to top burger menu < md breakpoint.
- **Cards:** `border-subtle` border, `bg-subtle` fill, 8px border-radius, `backdrop-blur(12px)` for premium feel.
- **Tables:** sticky header row, hover `bg-emphasis`, alternating-row tinting *off* (cleaner with restraint).
- **Charts:** thin lines (1.25–1.5px), no fill. Animate on viewport-enter once. Subtle "now" pulse on the most recent data point.
- **Stat cards:** big number (Geist Sans 32–40px), small label above (uppercase, mono, `--color-text-quaternary`), delta indicator inline.

### 9.5 Mobile (premium-bar)

Specific mobile adaptations (not afterthoughts):
- **Sidebar → top sticky bar with horizontal scroll between sections.** Burger only on very small viewports.
- **Hero stat strip → 2×2 grid** instead of 1×4, prevents tiny numbers
- **Leaderboards → cards stacking** instead of horizontal table — each row becomes a card with rank, primary metric large, supporting metrics small
- **Charts → simplified.** Remove gridlines and tick labels at < md, keep just the line + most-recent point. Add a small text-readout below.
- **Detail pages → single column, sectioned with mono labels** (`REVENUE TREND`, `TOP PAYING AGENTS`, etc.)
- **Tap targets ≥ 44px** throughout.

The mobile bar isn't "responsive" — it's deliberately reshaped. Premium feel preserved.

## 10. Tech stack (no changes from existing)

Already shipped: Next.js 16 + Tailwind v4 + Drizzle + `@neondatabase/serverless` + viem + Vercel + Geist fonts. New deps anticipated: maybe `recharts` or `tremor` for charts (TBD during implementation — the existing peg-chart inline-SVG pattern from the landing might be enough).

## 11. Roadmap

| version | scope | trigger |
|---|---|---|
| **v0** (this spec) | `/oli` shell + Dashboard + Services + Agents (10 curated) + hourly cron + public, no auth + desktop+mobile premium | Ship in 1 week |
| **v0.5** | Programmatic MPP service discovery (probe + auto-update `address_labels`) · Settlements raw view · Category mix breakdowns · Bridges section (LayerZero + Relay flows) | After v0 has any pickup (X engagement, Tempo-ecosystem mentions) |
| **v1** | Stablecoins / Peg / Issuer surfaces (port from archive — peg sampling, role holders, issuer activity) · Validator surfaces (registration, slashing) · Wallet/email gate for premium tier (alerts, history filters, watchlists) · API access (reuse @pelletfi/sdk + @pelletfi/mcp from archive, retargeted) | After v0.5 if expansion is warranted |
| **v∞** | Full Tempo ecosystem dashboard. Cross-chain agent activity (Solana, Hyperliquid). The OLI brand becomes the canonical "watch what agents are doing" lens across crypto. | Long-term |

## 12. Open questions

- **Aggregator decoding.** When ~30 services proxy through `paywithlocus.com` and ~10 proxy through `*.mpp.tempo.xyz`, do they collapse to single settlement addresses in v0? If yes, dashboard surfaces "Tempo MPP Aggregator" + "Locus Aggregator" as meta-services and we add per-service breakdown in v0.5 via calldata decoding. Verify during implementation.
- **Chart library.** `recharts` (mature, framer-motion-friendly) vs `tremor` (built-for-dashboards) vs hand-rolled SVG (matches the landing's peg chart aesthetic). Resolve during implementation; default to hand-rolled if the existing inline-SVG patterns scale.
- **Mobile sidebar pattern.** Top sticky bar with horizontal-scroll sections vs burger menu vs bottom-tab-nav. Prototype both, pick the one that feels premium not improvised.
- **OLI provenance UI.** Hover-tooltip is the safe default. Could be promoted to a per-event side-panel or a `/oli/methodology` page in v0.5 — surface choice depends on how much the audience cares about the discipline.
- **Dashboard polling.** Live block height polled every 6s is the only "live" element in v0. Should table data also poll (every 60s) or is hourly-snapshot-on-load enough? Default to hourly-snapshot to match the cron cadence; revisit if it feels stale.

## 13. Implementation cuts (ruthless v0 scope)

In scope:
- 5 routes (`/oli`, `/oli/services`, `/oli/services/[id]`, `/oli/agents`, `/oli/agents/[id]`)
- 5 API endpoints (the OLI projections — dashboard, services list/detail, agents list/detail)
- 10 curated MPP service address labels
- Hourly cron re-enabled
- OLI shell + sidebar (desktop + mobile)
- Hero stat strip + 3 leaderboard panels + recent-events stream on Dashboard
- Service detail with revenue trend + top payers + recent activity
- Agent detail with spend trend + service mix + recent activity

Out of scope (deferred to v0.5+):
- Programmatic discovery crawler
- Stablecoin / peg / issuer surfaces
- Bridges, validators, DEX, zone, fee-economics surfaces
- Calldata decoding for proxy-aggregated services
- Auth / wallet / email gating
- Alerts / watchlists / saved filters
- API / SDK / MCP republish
- Settlements raw-view page
- The existing v0-terminal components (`components/{header,event-card,feed,hero,status-indicator}.tsx`) — keep in tree as reference, don't surface

---

## Appendix A — File layout

```
app/oli/
├─ layout.tsx                  (OLI shell — sidebar + main, dark theme forced)
├─ page.tsx                    (Dashboard root)
├─ services/
│  ├─ page.tsx                 (services directory)
│  └─ [id]/page.tsx            (service detail)
└─ agents/
   ├─ page.tsx                 (agents directory)
   └─ [id]/page.tsx            (agent detail)

app/api/oli/
├─ dashboard/route.ts          (aggregate stats + leaderboards)
├─ services/
│  ├─ route.ts                 (list)
│  └─ [id]/route.ts            (detail)
└─ agents/
   ├─ route.ts
   └─ [id]/route.ts

components/oli/
├─ Sidebar.tsx                 (the OLI nav)
├─ StatStrip.tsx               (hero stat cards)
├─ Leaderboard.tsx             (generic ranked table)
├─ TrendChart.tsx              (line chart)
├─ EventStream.tsx             (decoded recent activity)
├─ ProvenanceBadge.tsx         (hover-reveal sourceBlock + methodologyVersion)
└─ MobileShell.tsx             (mobile-specific layout primitives)

lib/oli/
├─ queries.ts                  (Drizzle queries — leaderboard, trend, etc.)
├─ decode.ts                   (event row → human-readable summary, beyond what matcher.ts already does)
└─ format.ts                   (USDC.e formatting, time-ago, hash truncation)

data/
└─ mpp-services.ts             (the 10 curated service definitions for v0)

scripts/
└─ seed-services.ts            (one-shot: probe + write address_labels)
```

## Appendix B — Existing assets that survive

These were built in earlier sessions and remain useful:
- **`/Branding/`** — clean Illustrator source for the navy-blocky-tile P mark
- **`assets/pellet-mark.svg`** + raster variants — favicon + inline mark
- **`app/page.tsx`** + `HeroTerminal.tsx` — the marketing landing (lives at `/`, untouched by OLI)
- **`components/Nav.tsx` + `Footer.tsx`** — marketing chrome (auto-suppressed on `/oli/*`)
- **`lib/db/{client,schema,agents,agent-events}.ts`** — Drizzle setup + queries
- **`lib/ingest/{event-processor,cron-wrapper,abi,matcher,match-runner}.ts`** — the ingestion pipeline
- **`lib/rpc.ts`** — viem + tempo client
- **`app/api/{agents,feed,cron/*,v1/*}/route.ts`** — existing API surface
- **`drizzle/0000_*.sql`, `0001_agent_events_notify.sql`** — applied migrations

These were built but are NOT used by OLI v0 (kept in tree as reference for the deferred terminal-aesthetic rebuild):
- **`components/{header,event-card,feed,hero,status-indicator}.tsx`** — the live-feed terminal we built on day one. The OLI dashboard takes a different design direction; these stay as future reference.

## Appendix C — Why v0 narrows from spec v2

Spec v2 (`2026-04-29-pellet-oli-design.md`) framed the OLI as a watchable agentics terminal and centered the agent-spectator audience. After researching Tempo's MPP ecosystem, two things shifted:

1. **The MPP-aware lens is a category-creator opportunity** that doesn't exist yet. Generic "watch agents" is fine; "the canonical interface for autonomous economic activity" is sharper, more brandable, and matches the "Open-Ledger Interface" name better.
2. **The dashboard pattern beats the feed pattern** for the analyst/investor/operator audience that actually pays attention to MPP. Feed-style works for crypto-Twitter spectators alone; dashboard works for all three audience types.

v0 of this spec narrows scope to MPP/agents only (10 services). Stablecoin reconciliation (the original v1 spec from yesterday morning) and the broader Tempo ecosystem dashboard (the long-term ambition) both deferred to v0.5+ and v1+ respectively. Sequenced expansion preserves spec v2's strategic thesis (OLI on Tempo) while shipping a sharp v0 that won't get out-shipped.
