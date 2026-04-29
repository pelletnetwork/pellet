# Pellet OLI — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0 of Pellet OLI — a clean monospace web terminal showing AI agents operating on Tempo in real time, backed by methodology-versioned data with on-chain provenance.

**Architecture:** Next.js 16 App Router on Vercel. Postgres (Neon) via Drizzle ORM. viem + native Tempo RPC for chain reads. SSE for realtime push. Cursor-based block-range polling for ingestion (no webhook dependency). Curated allowlist of ~12 watched agents at launch.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Iosevka (via @fontsource), Drizzle ORM, `@neondatabase/serverless`, viem (`viem/tempo` chain extension), Vitest (unit), Playwright (smoke), Vercel (host + cron + analytics).

**Spec:** `docs/superpowers/specs/2026-04-29-pellet-oli-design.md`

**Source archive (carry-forward):** `github.com/pelletnetwork/pellet-tempo-archive` (cloned to `/tmp/pellet-archive` for reference during impl).

---

## What's already built (Tasks 1–5 from v1 plan, executed last night)

These survive the v1 → v2 pivot intact. Zero code changes needed.

- ✅ **Next.js 16 + Tailwind v4 + TypeScript scaffold** (commit `87f2469`)
- ✅ **Iosevka mono via `@fontsource/iosevka`, design tokens, glyph vocabulary** (commits `dc9d95f`, `f4a4926`, `3f60eec`, `a65e083`)
- ✅ **Pellet mark + favicon** — clean Illustrator source vectorized, dark + light variants, static `app/icon.png` (commits `7aad19d`, `fb250cd`, `e9ec6b8`)
- ✅ **Header + status indicator** (commit `e3d422b`)
- ✅ **Event card** with Pellet mark inline for Pellet-authored events (commit `c82db0e`)
- ✅ **Hero video sidebar** (commits `54177aa`, `bdc7682`, `3de487b`, `9e03d06`)
- ✅ **Vitest setup + 5 passing tests for `normalize`** (commits `248b55c`, `d12cd95`)

**One thing the v1 build did that v2 doesn't need:** `lib/ingest/normalize.ts` was written against `HeliusEnhancedTx` (Solana). That file gets replaced in Task 11 with a Tempo event matcher. The Vitest tests get rewritten with Tempo event fixtures. The pattern (idempotent matcher → DB row) is the same.

## File Structure (new files this plan creates)

```
pellet/
├─ Database (Drizzle)
│  ├─ drizzle.config.ts
│  ├─ drizzle/
│  │  ├─ 0001_events_and_cursors.sql        (port from archive 0001)
│  │  ├─ 0002_cron_runs.sql                 (port from archive 0008)
│  │  ├─ 0003_address_labels.sql            (port from archive 0009)
│  │  └─ 0004_agents_and_agent_events.sql   (new — agent tables)
│  └─ lib/db/
│     ├─ client.ts                          (port from archive — Drizzle + Neon serverless)
│     ├─ schema.ts                          (port subset from archive + add agents/agent_events)
│     ├─ agents.ts                          (new — list/upsert agent queries)
│     └─ agent-events.ts                    (new — feed query layer)
│
├─ RPC + ingestion (port verbatim where possible)
│  ├─ lib/rpc.ts                            (port from archive — viem + tempo)
│  ├─ lib/ingest/
│  │  ├─ abi.ts                             (port from archive)
│  │  ├─ cron-wrapper.ts                    (port from archive)
│  │  ├─ event-processor.ts                 (port from archive, adapted contracts list)
│  │  ├─ matcher.ts                         (new — replaces v1's normalize.ts)
│  │  └─ matcher.test.ts                    (new — Vitest, replaces v1's normalize.test.ts)
│  └─ lib/labels.ts                         (port from archive — address-label lookup)
│
├─ API routes
│  ├─ app/api/agents/route.ts               (new)
│  ├─ app/api/feed/route.ts                 (new — SSE)
│  ├─ app/api/cron/ingest/route.ts          (port from archive, calls processEvents)
│  ├─ app/api/cron/match/route.ts           (new — runs matcher across un-matched events)
│  └─ app/api/cron/pellet-tick/route.ts     (new — hourly Pellet observation)
│
├─ Realtime
│  └─ lib/realtime/bus.ts                   (new — pg LISTEN/NOTIFY → in-process EventEmitter)
│
├─ UI live wiring
│  └─ components/feed.tsx                   (new — replaces sample cards on home)
│
├─ Cron config
│  └─ vercel.json                           (new — schedules ingest + match + pellet-tick)
│
├─ Seed data
│  ├─ data/curated-agents.ts                (new — ~12 Tempo agent wallets)
│  └─ scripts/seed.ts                       (new — applies curated agents to DB)
│
└─ E2E
   ├─ playwright.config.ts                  (new)
   └─ tests/feed.e2e.spec.ts                (new — smoke)
```

## Decomposition rationale

- **`lib/db/`** — Drizzle schema + queries lives here. Port the `events` + `ingestion_cursors` + `cron_runs` + `address_labels` schema from archive verbatim; add the new `agents` + `agent_events` tables on top.
- **`lib/ingest/`** — porting `event-processor.ts` and `cron-wrapper.ts` is the day-one win. The matcher is the new piece (agent-aware layer on top of raw events).
- **Two-stage ingestion:** raw events ingested by `event-processor` (cron 1), then `matcher` runs (cron 2) and joins events to agents. Decoupling means raw event data is preserved for re-derivation if the agent allowlist changes.

---

## Phase A — Database setup

### Task 6: Vercel link + provision Neon Postgres (USER)

**Files:** none in repo (Vercel-side configuration only)

- [ ] **Step 1: Link this dir to the existing Vercel project**

```bash
cd /Users/jake/pellet
npx vercel link
```

Pick: existing project → `pellet` (under your account or `pelletnetwork` org).

- [ ] **Step 2: Provision Neon Postgres via Vercel Marketplace**

```bash
open "https://vercel.com/dashboard/stores"
```

Click "Create Database" → Neon → free tier → name it `pellet` → connect to the `pellet` project. Vercel auto-provisions `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, etc.

- [ ] **Step 3: Pull env vars locally**

```bash
npx vercel env pull .env.local
```

- [ ] **Step 4: Confirm**

```bash
grep '^POSTGRES_URL=' .env.local | head -1
```

Expected: `POSTGRES_URL="postgres://..."`

- [ ] **Step 5: Document required env vars**

Create `.env.example`:

```bash
# Database (auto-provisioned via Vercel + Neon)
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
DATABASE_URL=

# Cron auth (Vercel sets in production; required for /api/cron/* routes)
CRON_SECRET=

# Tempo RPC override (optional — defaults to public rpc.tempo.xyz)
TEMPO_RPC_URL=
```

- [ ] **Step 6: Commit `.env.example`**

```bash
git add .env.example
git commit -m "document required env vars"
```

---

### Task 7: Install Drizzle + `@neondatabase/serverless`, port `lib/db/client.ts`

**Files:**
- Create: `drizzle.config.ts`, `lib/db/client.ts`, `lib/db/schema.ts` (initially empty/stub)

- [ ] **Step 1: Install dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install --save-dev drizzle-kit
```

- [ ] **Step 2: Create the Drizzle config**

Create `drizzle.config.ts`:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? "",
  },
} satisfies Config;
```

- [ ] **Step 3: Build the db client (port pattern from archive)**

Create `lib/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL not set");
}

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
export const db = drizzle(pool, { schema });

// Dedicated connection for LISTEN/NOTIFY (cannot share with the pool).
export function listenPool(): Pool {
  return new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL,
    max: 1,
  });
}
```

- [ ] **Step 4: Stub the schema file**

Create `lib/db/schema.ts`:

```ts
// Schema definitions go here — populated by Task 8.
export {};
```

- [ ] **Step 5: Verify TS compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "install drizzle + neon serverless, db client"
```

---

### Task 8: Define schema (port from archive + agent tables)

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Define the full schema**

Replace `lib/db/schema.ts` with:

```ts
import {
  pgTable,
  text,
  serial,
  integer,
  bigint,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ── Raw chain events (port from archive 0001) ──────────────────────────────
// Idempotent by (tx_hash, log_index). Emitted by every contract Pellet watches.
export const events = pgTable(
  "events",
  {
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockTimestamp: timestamp("block_timestamp", { withTimezone: true }).notNull(),
    contract: text("contract").notNull(),
    eventType: text("event_type").notNull(),
    args: jsonb("args").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.txHash, t.logIndex] }),
    contractBlockIdx: index("events_contract_block_idx").on(t.contract, t.blockNumber),
    blockTimestampIdx: index("events_block_timestamp_idx").on(t.blockTimestamp),
  }),
);

// ── Ingestion cursors (port from archive 0001) ────────────────────────────
export const ingestionCursors = pgTable("ingestion_cursors", {
  contract: text("contract").primaryKey(),
  lastBlock: bigint("last_block", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Cron runs log (port from archive 0008) ────────────────────────────────
export const cronRuns = pgTable(
  "cron_runs",
  {
    id: serial("id").primaryKey(),
    cronName: text("cron_name").notNull(),
    status: text("status").notNull(), // 'ok' | 'error'
    durationMs: integer("duration_ms").notNull(),
    detail: jsonb("detail"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    nameStartedIdx: index("cron_runs_name_started_idx").on(t.cronName, t.startedAt),
  }),
);

// ── Address labels (port from archive 0009) ───────────────────────────────
export const addressLabels = pgTable(
  "address_labels",
  {
    address: text("address").primaryKey(), // lowercased
    label: text("label").notNull(),
    category: text("category").notNull(), // 'agent' | 'contract' | 'token' | etc.
    source: text("source").notNull(),     // 'curated' | 'pellet' | etc.
    notes: jsonb("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("address_labels_category_idx").on(t.category),
  }),
);

// ── Agents (new — v2) ─────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // slug ('pellet', 'aixbt-tempo', etc.)
  label: text("label").notNull(),
  source: text("source").notNull(), // 'curated' | 'pellet' | 'registry:*'
  wallets: text("wallets").array().notNull().default([]),
  bio: text("bio"),
  links: jsonb("links").notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Agent events (new — v2) ───────────────────────────────────────────────
// Joins raw events to agents with a human-legible summary + OLI provenance.
// One row per (event, agent) match — same event can match multiple agents.
export const agentEvents = pgTable(
  "agent_events",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    kind: text("kind").notNull(), // 'transfer' | 'swap' | 'mint' | 'program_call' | 'attest' | 'custom'
    summary: text("summary").notNull(),
    targets: jsonb("targets").notNull().default({}),
    sourceBlock: bigint("source_block", { mode: "number" }).notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tsIdx: index("agent_events_ts_idx").on(t.ts),
    agentTsIdx: index("agent_events_agent_ts_idx").on(t.agentId, t.ts),
    eventRefIdx: index("agent_events_event_ref_idx").on(t.txHash, t.logIndex),
  }),
);
```

- [ ] **Step 2: Generate migrations**

```bash
npx drizzle-kit generate
```

Expected: writes `drizzle/0000_*.sql` with the full schema.

- [ ] **Step 3: Add NOTIFY trigger as a manual migration**

The realtime bus needs a `NOTIFY` trigger on `agent_events` insert. Add `drizzle/0001_agent_events_notify.sql`:

```sql
CREATE OR REPLACE FUNCTION notify_agent_event_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('agent_events', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_events_notify ON agent_events;
CREATE TRIGGER agent_events_notify
AFTER INSERT ON agent_events
FOR EACH ROW EXECUTE FUNCTION notify_agent_event_insert();
```

- [ ] **Step 4: Apply migrations to dev DB**

Install psql if needed (`brew install libpq && brew link --force libpq`), then:

```bash
source .env.local && for f in drizzle/*.sql; do
  echo "applying $f..."
  psql "$POSTGRES_URL_NON_POOLING" -f "$f"
done
```

- [ ] **Step 5: Verify schema**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "\dt" -c "\d agent_events"
```

Expected: `events`, `ingestion_cursors`, `cron_runs`, `address_labels`, `agents`, `agent_events` tables; `agent_events` has the trigger.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "schema + migrations: events + cursors + cron runs + labels + agents"
```

---

## Phase B — Port the ingestion pipeline

### Task 9: Port `lib/rpc.ts` from archive

**Files:**
- Create: `lib/rpc.ts`

- [ ] **Step 1: Install viem**

```bash
npm install viem
```

- [ ] **Step 2: Port the RPC client verbatim (with one tweak)**

Create `lib/rpc.ts`:

```ts
import { createPublicClient, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

// Native Tempo RPC handles wide getLogs ranges and single reads without rate
// limits. Use rpc.tempo.xyz (canonical public endpoint, chainId 4217).
//
// Override via TEMPO_RPC_URL env when needed (e.g., custom indexer endpoint).
const RPC_URL = process.env.TEMPO_RPC_URL ?? "https://rpc.tempo.xyz";

export const tempoClient = createPublicClient({
  chain: tempo,
  transport: http(RPC_URL, { timeout: 10_000, retryCount: 2 }),
}).extend(tempoActions());

// Dedicated client for historical getLogs (bulk-range backfill).
export const ingestClient = createPublicClient({
  chain: tempo,
  transport: http(RPC_URL),
}).extend(tempoActions());
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "port lib/rpc.ts (viem + tempo) from archive"
```

---

### Task 10: Port `cron-wrapper.ts` + `abi.ts` + `event-processor.ts`

**Files:**
- Create: `lib/ingest/cron-wrapper.ts`, `lib/ingest/abi.ts`, `lib/ingest/event-processor.ts`

- [ ] **Step 1: Port `cron-wrapper.ts` verbatim (Drizzle-aware)**

Create `lib/ingest/cron-wrapper.ts`:

```ts
import { db } from "@/lib/db/client";
import { cronRuns } from "@/lib/db/schema";

export async function runCron<T>(
  cronName: string,
  handler: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const startedAt = new Date();
  const t0 = Date.now();
  try {
    const result = await handler();
    const durationMs = Date.now() - t0;
    await db
      .insert(cronRuns)
      .values({
        cronName,
        status: "ok",
        durationMs,
        detail: result as object,
        startedAt,
      })
      .catch(() => {});
    return { ok: true, result };
  } catch (e) {
    const durationMs = Date.now() - t0;
    const message = e instanceof Error ? e.message : String(e);
    await db
      .insert(cronRuns)
      .values({
        cronName,
        status: "error",
        durationMs,
        error: message,
        startedAt,
      })
      .catch(() => {});
    return { ok: false, error: message };
  }
}
```

- [ ] **Step 2: Port `abi.ts` from archive**

```bash
cp /tmp/pellet-archive/lib/ingest/abi.ts lib/ingest/abi.ts
```

(If `/tmp/pellet-archive` was cleaned up: `gh repo clone pelletnetwork/pellet-tempo-archive /tmp/pellet-archive -- --depth=1` first.)

- [ ] **Step 3: Port `event-processor.ts` (adapted contracts list)**

Create `lib/ingest/event-processor.ts` based on archive's version, with the watched-contracts list adapted for v0:

```ts
import { ingestClient } from "@/lib/rpc";
import { db } from "@/lib/db/client";
import { events, ingestionCursors, agents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const CHUNK_BLOCKS = 1_000;
const MAX_BLOCKS_PER_RUN = 100_000;
const CONFIRMATIONS = 2;
const BACKFILL_FROM_BLOCK = process.env.BACKFILL_FROM_BLOCK
  ? Number(process.env.BACKFILL_FROM_BLOCK)
  : null;

const GLOBAL_CURSOR = "__global__";

async function getCursor(): Promise<number> {
  const rows = await db
    .select()
    .from(ingestionCursors)
    .where(sql`${ingestionCursors.contract} = ${GLOBAL_CURSOR}`)
    .limit(1);
  return rows[0]?.lastBlock ?? 0;
}

async function setCursor(block: number): Promise<void> {
  await db
    .insert(ingestionCursors)
    .values({ contract: GLOBAL_CURSOR, lastBlock: block })
    .onConflictDoUpdate({
      target: ingestionCursors.contract,
      set: { lastBlock: block, updatedAt: new Date() },
    });
}

// Watched contracts list. Built dynamically from:
// 1. Wallets of all active agents (we want events FROM/TO those wallets)
// 2. A future static list of high-value contracts (Tempo DEXes, stables, etc.)
//
// For v0 we filter by topic1/topic2 == agent wallet rather than by emitter
// address — since most agent activity emits from external contracts (DEX,
// token contract), not from the agent's own wallet.
async function buildTopicFilter(): Promise<string[]> {
  const activeAgents = await db
    .select({ wallets: agents.wallets })
    .from(agents)
    .where(sql`${agents.active} = true`);
  const allWallets = new Set<string>();
  for (const a of activeAgents) {
    for (const w of a.wallets ?? []) {
      allWallets.add(w.toLowerCase());
    }
  }
  // Pad addresses to 32-byte topic format: 0x + 24 zeros + 40 hex chars.
  return [...allWallets].map((w) =>
    `0x000000000000000000000000${w.replace(/^0x/, "").toLowerCase()}`,
  );
}

export interface ProcessResult {
  blocksProcessed: number;
  eventsIngested: number;
  caughtUp: boolean;
  fromBlock: number;
  toBlock: number;
}

export async function processEvents(): Promise<ProcessResult> {
  const chainHead = Number(await ingestClient.getBlockNumber());
  const safeHead = Math.max(0, chainHead - CONFIRMATIONS);
  const cursor = await getCursor();
  const coldStartBlock = BACKFILL_FROM_BLOCK ?? Math.max(0, safeHead - 100);
  const startBlock = cursor === 0 ? coldStartBlock : cursor + 1;
  const endBlock = Math.min(safeHead, startBlock + MAX_BLOCKS_PER_RUN);

  if (startBlock > endBlock) {
    return { blocksProcessed: 0, eventsIngested: 0, caughtUp: true, fromBlock: startBlock, toBlock: endBlock };
  }

  const topicFilter = await buildTopicFilter();
  if (topicFilter.length === 0) {
    // No watched agents yet — advance cursor without ingesting.
    await setCursor(endBlock);
    return { blocksProcessed: endBlock - startBlock + 1, eventsIngested: 0, caughtUp: endBlock === safeHead, fromBlock: startBlock, toBlock: endBlock };
  }

  let inserted = 0;
  let from = startBlock;

  while (from <= endBlock) {
    const to = Math.min(from + CHUNK_BLOCKS - 1, endBlock);

    // Two passes: events where topic1 OR topic2 matches a watched wallet.
    // Tempo's getLogs supports topic-position filtering.
    const passes = [
      ingestClient.getLogs({
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
        topics: [null, topicFilter] as never,
      }),
      ingestClient.getLogs({
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
        topics: [null, null, topicFilter] as never,
      }),
    ];
    const [logs1, logs2] = await Promise.all(passes);
    const allLogs = [...logs1, ...logs2];

    if (allLogs.length > 0) {
      const uniqueBlocks = [...new Set(allLogs.map((l) => l.blockNumber!))];
      const blockTimestamps = new Map<bigint, Date>();
      for (const bn of uniqueBlocks) {
        const block = await ingestClient.getBlock({ blockNumber: bn });
        blockTimestamps.set(bn, new Date(Number(block.timestamp) * 1000));
      }

      const rows = allLogs.map((log) => ({
        txHash: log.transactionHash!,
        logIndex: log.logIndex!,
        blockNumber: Number(log.blockNumber!),
        blockTimestamp: blockTimestamps.get(log.blockNumber!)!,
        contract: log.address.toLowerCase(),
        eventType: log.topics[0] ?? "unknown",
        args: { topics: log.topics, data: log.data },
      }));

      await db.insert(events).values(rows).onConflictDoNothing();
      inserted += rows.length;
    }

    from = to + 1;
  }

  await setCursor(endBlock);

  return {
    blocksProcessed: endBlock - startBlock + 1,
    eventsIngested: inserted,
    caughtUp: endBlock === safeHead,
    fromBlock: startBlock,
    toBlock: endBlock,
  };
}
```

(This is a meaningful adaptation of the archive version — it filters by agent wallets in topic1/topic2 instead of by stablecoin contract addresses. The structural pattern — cursor, chunked, idempotent — is preserved.)

- [ ] **Step 4: Verify TS compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/ingest/
git commit -m "port event ingestion pipeline (rpc + cron-wrapper + abi + event-processor)"
```

---

### Task 11: Replace `normalize` with `matcher` (TDD)

The v1 `lib/ingest/normalize.ts` was Solana/Helius-shaped. Replace with a Tempo-shaped matcher that takes a raw `events` row and an agent registry, decides which agents the event involves, and produces `agent_events` rows.

**Files:**
- Delete: `lib/ingest/normalize.ts`, `lib/ingest/normalize.test.ts`
- Create: `lib/ingest/matcher.ts`, `lib/ingest/matcher.test.ts`

- [ ] **Step 1: Delete the v1 normalize files**

```bash
git rm lib/ingest/normalize.ts lib/ingest/normalize.test.ts
```

- [ ] **Step 2: Write the failing matcher test**

Create `lib/ingest/matcher.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchEvent } from "./matcher";

const TEST_AGENT = {
  id: "aixbt",
  label: "aixbt",
  wallets: ["0x000000000000000000000000abcdef0000000000000000000000000000000001"],
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

describe("matchEvent", () => {
  it("matches an agent when its wallet appears as topic1 (from)", () => {
    const evt = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [TRANSFER_TOPIC, TEST_AGENT.wallets[0], "0xrecipient"],
        data: "0x...",
      },
    };
    const matches = matchEvent(evt, [TEST_AGENT]);
    expect(matches).toHaveLength(1);
    expect(matches[0].agentId).toBe("aixbt");
    expect(matches[0].kind).toBe("transfer");
    expect(matches[0].summary).toContain("aixbt");
  });

  it("matches an agent when its wallet appears as topic2 (to)", () => {
    const evt = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: {
        topics: [TRANSFER_TOPIC, "0xsender", TEST_AGENT.wallets[0]],
        data: "0x...",
      },
    };
    const matches = matchEvent(evt, [TEST_AGENT]);
    expect(matches).toHaveLength(1);
  });

  it("returns empty when no agent wallet matches", () => {
    const evt = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: { topics: [TRANSFER_TOPIC, "0xunrelated", "0xunrelated2"], data: "0x" },
    };
    const matches = matchEvent(evt, [TEST_AGENT]);
    expect(matches).toHaveLength(0);
  });

  it("attaches OLI provenance (sourceBlock + methodologyVersion)", () => {
    const evt = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 12345,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xToken",
      eventType: TRANSFER_TOPIC,
      args: { topics: [TRANSFER_TOPIC, TEST_AGENT.wallets[0], "0xx"], data: "0x" },
    };
    const matches = matchEvent(evt, [TEST_AGENT]);
    expect(matches[0].sourceBlock).toBe(12345);
    expect(matches[0].methodologyVersion).toMatch(/^v\d+\.\d+$/);
  });

  it("kinds unknown event types as 'custom'", () => {
    const evt = {
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 100,
      blockTimestamp: new Date(1714435200_000),
      contract: "0xWeirdContract",
      eventType: "0xdeadbeef",
      args: { topics: ["0xdeadbeef", TEST_AGENT.wallets[0]], data: "0x" },
    };
    const matches = matchEvent(evt, [TEST_AGENT]);
    expect(matches[0].kind).toBe("custom");
  });
});
```

- [ ] **Step 3: Run tests — expect failures**

```bash
npm test
```

Expected: 5 fails ("Cannot find module ./matcher").

- [ ] **Step 4: Implement matcher**

Create `lib/ingest/matcher.ts`:

```ts
const METHODOLOGY_VERSION = "v0.1";

// Topic-0 hashes for known event types.
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const KIND_BY_TOPIC: Record<string, string> = {
  [TRANSFER_TOPIC]: "transfer",
  // Add more as we identify them — swap, mint, etc.
};

export type RawEventRow = {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: Date;
  contract: string;
  eventType: string;
  args: { topics: string[]; data: string };
};

export type AgentLite = {
  id: string;
  label: string;
  wallets: string[]; // 32-byte topic format (0x + 24 zeros + 40 hex chars)
};

export type AgentEventMatch = {
  agentId: string;
  txHash: string;
  logIndex: number;
  ts: Date;
  kind: string;
  summary: string;
  targets: Record<string, unknown>;
  sourceBlock: number;
  methodologyVersion: string;
};

export function matchEvent(
  evt: RawEventRow,
  agents: AgentLite[],
): AgentEventMatch[] {
  const matches: AgentEventMatch[] = [];
  const topics = evt.args.topics ?? [];

  for (const agent of agents) {
    const walletSet = new Set(agent.wallets.map((w) => w.toLowerCase()));
    const involved = topics.some((t) => t && walletSet.has(t.toLowerCase()));
    if (!involved) continue;

    const kind = KIND_BY_TOPIC[evt.eventType] ?? "custom";
    matches.push({
      agentId: agent.id,
      txHash: evt.txHash,
      logIndex: evt.logIndex,
      ts: evt.blockTimestamp,
      kind,
      summary: buildSummary(evt, agent, kind),
      targets: { contract: evt.contract, eventType: evt.eventType },
      sourceBlock: evt.blockNumber,
      methodologyVersion: METHODOLOGY_VERSION,
    });
  }
  return matches;
}

function buildSummary(evt: RawEventRow, agent: AgentLite, kind: string): string {
  switch (kind) {
    case "transfer":
      return `${agent.label} ${kind} via ${evt.contract.slice(0, 10)}…`;
    case "swap":
      return `${agent.label} swapped via ${evt.contract.slice(0, 10)}…`;
    default:
      return `${agent.label} interacted with ${evt.contract.slice(0, 10)}…`;
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test
```

Expected: 5/5 pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "replace solana normalize with tempo-shaped agent event matcher"
```

---

### Task 12: Add the match cron + insert agent_events

**Files:**
- Create: `lib/ingest/match-runner.ts`, `app/api/cron/match/route.ts`

- [ ] **Step 1: Build the match runner**

Create `lib/ingest/match-runner.ts`:

```ts
import { db } from "@/lib/db/client";
import { events, agents, agentEvents } from "@/lib/db/schema";
import { matchEvent, type AgentLite, type RawEventRow } from "./matcher";
import { sql } from "drizzle-orm";

// Pulls events that haven't been matched yet, runs the matcher, inserts
// agent_events rows. Idempotent — re-running won't duplicate matches because
// we filter on a NOT EXISTS subquery against agent_events.
export async function runMatcher(limit = 1000): Promise<{ scanned: number; matched: number }> {
  const activeAgents = await db
    .select({ id: agents.id, label: agents.label, wallets: agents.wallets })
    .from(agents)
    .where(sql`${agents.active} = true`);

  if (activeAgents.length === 0) return { scanned: 0, matched: 0 };

  // Pull unmatched events (no agent_events row referencing them).
  const unmatched = await db.execute<RawEventRow>(sql`
    SELECT
      e.tx_hash      AS "txHash",
      e.log_index    AS "logIndex",
      e.block_number AS "blockNumber",
      e.block_timestamp AS "blockTimestamp",
      e.contract,
      e.event_type   AS "eventType",
      e.args
    FROM events e
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_events ae
      WHERE ae.tx_hash = e.tx_hash AND ae.log_index = e.log_index
    )
    ORDER BY e.block_timestamp DESC
    LIMIT ${limit}
  `);

  const scanned = unmatched.rows.length;
  let matched = 0;

  const lite: AgentLite[] = activeAgents.map((a) => ({
    id: a.id,
    label: a.label,
    wallets: a.wallets ?? [],
  }));

  for (const row of unmatched.rows) {
    const matches = matchEvent(row as RawEventRow, lite);
    if (matches.length === 0) continue;

    await db
      .insert(agentEvents)
      .values(
        matches.map((m) => ({
          agentId: m.agentId,
          txHash: m.txHash,
          logIndex: m.logIndex,
          ts: m.ts,
          kind: m.kind,
          summary: m.summary,
          targets: m.targets,
          sourceBlock: m.sourceBlock,
          methodologyVersion: m.methodologyVersion,
        })),
      )
      .onConflictDoNothing();
    matched += matches.length;
  }

  return { scanned, matched };
}
```

- [ ] **Step 2: Create the match cron route**

Create `app/api/cron/match/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runMatcher } from "@/lib/ingest/match-runner";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("match", () => runMatcher());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as object) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
```

- [ ] **Step 3: Verify TS compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "add match runner + cron route — events → agent_events"
```

---

### Task 13: Port the ingest cron route

**Files:**
- Create: `app/api/cron/ingest/route.ts`

- [ ] **Step 1: Port the cron handler verbatim from archive**

Create `app/api/cron/ingest/route.ts`:

```ts
import { NextResponse } from "next/server";
import { processEvents } from "@/lib/ingest/event-processor";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("ingest", () => processEvents());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as object) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "port /api/cron/ingest route from archive"
```

---

## Phase C — Seed agents

### Task 14: Seed the curated Tempo agent allowlist

**Files:**
- Create: `data/curated-agents.ts`, `lib/db/agents.ts`, `scripts/seed.ts`

- [ ] **Step 1: Define seed structure**

Create `data/curated-agents.ts`:

```ts
export type SeedAgent = {
  id: string;
  label: string;
  source: "curated" | "pellet";
  wallets: string[]; // Tempo addresses, lowercased
  bio: string;
  links: { x?: string; site?: string };
};

export const CURATED_AGENTS: SeedAgent[] = [
  {
    id: "pellet",
    label: "pellet",
    source: "pellet",
    wallets: [], // TODO: pellet's own Tempo wallet (research pass)
    bio: "the agent that runs this terminal.",
    links: { x: "pelletnetwork", site: "pellet.network" },
  },
  // Research pass: populate with ~11 watched Tempo agents.
  // Anchor candidates: known Tempo agent wallets surfaced from the prior
  // build's address_labels (where category = 'agent'). See spec §13.
];
```

- [ ] **Step 2: Build the agent query module**

Create `lib/db/agents.ts`:

```ts
import { db } from "./client";
import { agents, type } from "./schema";
import type { SeedAgent } from "@/data/curated-agents";
import { eq } from "drizzle-orm";

export async function listActiveAgents() {
  return db.select().from(agents).where(eq(agents.active, true));
}

export async function upsertAgent(a: SeedAgent): Promise<void> {
  await db
    .insert(agents)
    .values({
      id: a.id,
      label: a.label,
      source: a.source,
      wallets: a.wallets,
      bio: a.bio,
      links: a.links,
    })
    .onConflictDoUpdate({
      target: agents.id,
      set: {
        label: a.label,
        source: a.source,
        wallets: a.wallets,
        bio: a.bio,
        links: a.links,
      },
    });
}
```

- [ ] **Step 3: Build the seed script**

Create `scripts/seed.ts`:

```ts
import { CURATED_AGENTS } from "@/data/curated-agents";
import { upsertAgent } from "@/lib/db/agents";

async function main() {
  for (const agent of CURATED_AGENTS) {
    await upsertAgent(agent);
    console.log(`✓ ${agent.id}`);
  }
  console.log(`seeded ${CURATED_AGENTS.length} agent(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add seed script + tsx**

```bash
npm install --save-dev tsx
```

In `package.json` scripts:

```json
"seed": "tsx --env-file=.env.local scripts/seed.ts"
```

- [ ] **Step 5: Run seed**

```bash
npm run seed
```

Expected: `✓ pellet` then `seeded 1 agent(s)`.

- [ ] **Step 6: Verify**

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c "SELECT id, label, source FROM agents;"
```

- [ ] **Step 7: Commit**

```bash
git add data/ lib/db/agents.ts scripts/ package.json package-lock.json
git commit -m "seed curated agent list (pellet only; research pass to follow)"
```

---

## Phase D — Feed API

### Task 15: GET /api/agents

**Files:**
- Create: `app/api/agents/route.ts`

- [ ] **Step 1: Build the route**

Create `app/api/agents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listActiveAgents } from "@/lib/db/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await listActiveAgents();
  return NextResponse.json({ agents });
}
```

- [ ] **Step 2: Verify**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -s http://localhost:3000/api/agents | head -c 300
kill $DEV 2>/dev/null
```

Expected: JSON `{"agents":[{"id":"pellet",...}]}`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "add GET /api/agents"
```

---

### Task 16: Realtime bus + GET /api/feed (SSE)

**Files:**
- Create: `lib/realtime/bus.ts`, `lib/db/agent-events.ts`, `app/api/feed/route.ts`

- [ ] **Step 1: Build the recent-events query**

Create `lib/db/agent-events.ts`:

```ts
import { db } from "./client";
import { agentEvents, agents } from "./schema";
import { desc, eq, sql } from "drizzle-orm";

export type FeedRow = {
  id: number;
  agentId: string;
  agentLabel: string;
  ts: Date;
  kind: string;
  summary: string;
  txHash: string;
  sourceBlock: number;
  methodologyVersion: string;
  isPellet: boolean;
};

export async function recentFeed(limit = 100): Promise<FeedRow[]> {
  const rows = await db
    .select({
      id: agentEvents.id,
      agentId: agentEvents.agentId,
      agentLabel: agents.label,
      ts: agentEvents.ts,
      kind: agentEvents.kind,
      summary: agentEvents.summary,
      txHash: agentEvents.txHash,
      sourceBlock: agentEvents.sourceBlock,
      methodologyVersion: agentEvents.methodologyVersion,
    })
    .from(agentEvents)
    .innerJoin(agents, eq(agents.id, agentEvents.agentId))
    .orderBy(desc(agentEvents.ts))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    isPellet: r.agentId === "pellet",
  }));
}

export async function getFeedRowById(id: number): Promise<FeedRow | null> {
  const rows = await db
    .select({
      id: agentEvents.id,
      agentId: agentEvents.agentId,
      agentLabel: agents.label,
      ts: agentEvents.ts,
      kind: agentEvents.kind,
      summary: agentEvents.summary,
      txHash: agentEvents.txHash,
      sourceBlock: agentEvents.sourceBlock,
      methodologyVersion: agentEvents.methodologyVersion,
    })
    .from(agentEvents)
    .innerJoin(agents, eq(agents.id, agentEvents.agentId))
    .where(eq(agentEvents.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...rows[0], isPellet: rows[0].agentId === "pellet" };
}
```

- [ ] **Step 2: Build the realtime bus**

Create `lib/realtime/bus.ts`:

```ts
import { EventEmitter } from "node:events";
import { listenPool } from "@/lib/db/client";
import { getFeedRowById, type FeedRow } from "@/lib/db/agent-events";

class Bus extends EventEmitter {
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    const pool = listenPool();
    const client = await pool.connect();
    client.on("notification", async (msg) => {
      if (msg.channel !== "agent_events" || !msg.payload) return;
      const row = await getFeedRowById(Number(msg.payload));
      if (row) this.emit("event", row);
    });
    await client.query("LISTEN agent_events");
  }
}

const _bus = new Bus();
export function bus(): Bus {
  return _bus;
}
export type { FeedRow };
```

- [ ] **Step 3: Build the SSE route**

Create `app/api/feed/route.ts`:

```ts
import { recentFeed } from "@/lib/db/agent-events";
import { bus, type FeedRow } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FeedPayload = {
  id: string;
  agentId: string;
  agentLabel: string;
  ts: string;
  kind: string;
  summary: string;
  txSig: string;
  sourceBlock: number;
  methodologyVersion: string;
  isPellet: boolean;
};

function toPayload(r: FeedRow): FeedPayload {
  return {
    id: String(r.id),
    agentId: r.agentId,
    agentLabel: r.agentLabel,
    ts: r.ts.toISOString(),
    kind: r.kind,
    summary: r.summary,
    txSig: r.txHash,
    sourceBlock: r.sourceBlock,
    methodologyVersion: r.methodologyVersion,
    isPellet: r.isPellet,
  };
}

export async function GET() {
  await bus().start();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: FeedPayload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const recent = await recentFeed(100);
      for (const r of recent.reverse()) send(toPayload(r));

      const onEvent = (row: FeedRow) => send(toPayload(row));
      bus().on("event", onEvent);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        bus().off("event", onEvent);
        try { controller.close(); } catch {}
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (controller as any).signal?.addEventListener?.("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
curl -N http://localhost:3000/api/feed | head -c 500
kill $DEV 2>/dev/null
```

Expected: `data: {...}` lines (likely empty initially since no events yet), then heartbeat comments.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "add realtime bus + GET /api/feed (SSE)"
```

---

## Phase E — Wire the UI to live data

### Task 17: Convert Feed into a live SSE consumer

**Files:**
- Modify: `components/event-card.tsx` (extend FeedEvent type with OLI provenance)
- Create: `components/feed.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Extend the FeedEvent type for OLI provenance**

In `components/event-card.tsx`, extend the type and surface provenance subtly on hover:

```ts
export type FeedEvent = {
  id: string;
  agentId: string;
  agentLabel: string;
  ts: string;
  kind: string;
  summary: string;
  txSig: string | null;
  sourceBlock?: number;
  methodologyVersion?: string;
  isPellet?: boolean;
};
```

In the card body, add a `<title>` attribute on the article element (or a custom tooltip) that exposes: `block ${sourceBlock} · methodology ${methodologyVersion}`.

- [ ] **Step 2: Build the live feed client component**

Create `components/feed.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { EventCard, type FeedEvent } from "./event-card";
import { glyphs } from "@/lib/design/glyphs";

const MAX_EVENTS = 500;
type ConnectionState = "connecting" | "live" | "error";

export function Feed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [conn, setConn] = useState<ConnectionState>("connecting");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/feed");
    es.onopen = () => setConn("live");
    es.onerror = () => setConn("error");
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as FeedEvent;
        if (seen.current.has(event.id)) return;
        seen.current.add(event.id);
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // ignore malformed payloads
      }
    };
    return () => es.close();
  }, []);

  if (conn === "connecting" && events.length === 0) {
    return (
      <div className="text-muted py-12 text-center text-sm">
        <span className="animate-pulse">{glyphs.loadingFilled.repeat(5)}</span>
        <p className="mt-2">syncing feed</p>
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-muted text-sm">no events yet · waiting for agents</p>;
  }

  return (
    <div className="space-y-2">
      {conn === "error" && (
        <p className="text-accent text-xs">feed disconnected · retrying...</p>
      )}
      {events.map((e) => (
        <div key={e.id} className="animate-[slide-in_200ms_ease-out]">
          <EventCard event={e} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Replace sample cards with live feed in `app/page.tsx`**

Update `app/page.tsx` to:

```tsx
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Feed } from "@/components/feed";
import { listActiveAgents } from "@/lib/db/agents";

export const dynamic = "force-dynamic";

export default async function Page() {
  const agents = await listActiveAgents();
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={agents.length} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="space-y-2 md:order-first">
            <Feed />
          </div>
          <aside className="md:order-last">
            <Hero />
          </aside>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: End-to-end smoke (manual)**

```bash
npm run dev
```

1. Open `http://localhost:3000` — see "no events yet" or empty feed (no events ingested yet).
2. Insert a fake agent_event manually via psql:

```bash
source .env.local && psql "$POSTGRES_URL_NON_POOLING" -c \
  "INSERT INTO agent_events (agent_id, tx_hash, log_index, ts, kind, summary, source_block, methodology_version) VALUES ('pellet', '0xabc', 0, now(), 'custom', 'manual test event', 0, 'v0.1');"
```

3. Card slides in within ~1 second. Stop dev.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "wire live SSE feed to home page"
```

---

## Phase F — Pellet's own loop + cron schedule

### Task 18: Hourly Pellet observation cron + cron config

**Files:**
- Create: `app/api/cron/pellet-tick/route.ts`, `vercel.json`

- [ ] **Step 1: Build the cron handler**

Create `app/api/cron/pellet-tick/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { agentEvents, agents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function postObservation() {
  const [{ n: agentN }] = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM agents WHERE active = TRUE`,
  ).then((r) => r.rows);
  const [{ n: eventN }] = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM agent_events WHERE ts > now() - interval '1 hour'`,
  ).then((r) => r.rows);

  const summary = `noted: ${agentN} agents tracked · ${eventN} events in the last hour`;

  await db.insert(agentEvents).values({
    agentId: "pellet",
    txHash: `pellet-tick-${Date.now()}`,
    logIndex: 0,
    ts: new Date(),
    kind: "custom",
    summary,
    targets: {},
    sourceBlock: 0,
    methodologyVersion: "v0.1",
  });

  return { summary };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("pellet-tick", postObservation);
  if (wrapped.ok) return NextResponse.json({ ok: true, ...wrapped.result });
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
```

- [ ] **Step 2: Add cron schedule**

Create `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/ingest", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/match",  "schedule": "*/2 * * * *" },
    { "path": "/api/cron/pellet-tick", "schedule": "0 * * * *" }
  ]
}
```

(Ingest + match every 2 min; pellet-tick hourly.)

- [ ] **Step 3: Manual verify**

```bash
npm run dev > /tmp/dev.log 2>&1 & DEV=$!
sleep 6
source .env.local
curl -s "http://localhost:3000/api/cron/pellet-tick" -H "authorization: Bearer ${CRON_SECRET:-test-cron-local}"
kill $DEV 2>/dev/null
```

Expected: `{"ok":true,"summary":"noted: 1 agents tracked · ..."}`. The pellet-tick observation appears in the feed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "add hourly pellet observation cron + vercel.json schedule"
```

---

## Phase G — Smoke test + deploy

### Task 19: Playwright smoke

**Files:**
- Create: `playwright.config.ts`, `tests/feed.e2e.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm init playwright@latest -- --quiet --browser=chromium --no-examples
```

- [ ] **Step 2: Configure**

Replace `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.spec\.ts/,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Add e2e script**

In `package.json`:

```json
"e2e": "playwright test"
```

- [ ] **Step 4: Write the smoke test**

Create `tests/feed.e2e.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("home renders header + feed shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header")).toContainText("pellet");
  await expect(page.locator("header")).toContainText("open-ledger interface");
});

test("favicon serves", async ({ request }) => {
  const res = await request.get("/icon.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("agents api returns json", async ({ request }) => {
  const res = await request.get("/api/agents");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.agents)).toBe(true);
});

test("feed api returns SSE stream", async ({ request }) => {
  const res = await request.get("/api/feed");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/event-stream");
});
```

- [ ] **Step 5: Update header copy from spec v2**

In `components/header.tsx`, change the wordmark from `agentics terminal · sol` to `open-ledger interface · tempo`:

```tsx
<span className="text-sm tracking-tight text-fg">
  pellet <span className="text-muted">// open-ledger interface · tempo</span>
</span>
```

- [ ] **Step 6: Run smoke**

```bash
npm run e2e
```

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "add playwright smoke + update header copy for OLI framing"
```

---

### Task 20: Vercel deploy + domain

**Files:** none

- [ ] **Step 1: Generate prod CRON_SECRET**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Save the value.

- [ ] **Step 2: Set on Vercel**

```bash
npx vercel env add CRON_SECRET production
# paste the value
```

(POSTGRES_* were auto-provisioned in Task 6.)

- [ ] **Step 3: Preview deploy**

```bash
npx vercel
```

Visit the preview URL — confirm header, `/api/agents` returns the seeded `pellet` agent, `/api/feed` streams.

- [ ] **Step 4: Apply schema to prod DB**

```bash
npx vercel env pull .env.production --environment=production
source .env.production && for f in drizzle/*.sql; do
  psql "$POSTGRES_URL_NON_POOLING" -f "$f"
done
source .env.production && npm run seed
```

- [ ] **Step 5: Promote to production**

```bash
npx vercel --prod
```

- [ ] **Step 6: Attach pellet.network**

```bash
npx vercel domains add pellet.network
# follow DNS instructions at registrar
# wait for propagation
npx vercel alias set <prod-deploy-url> pellet.network
```

- [ ] **Step 7: Final smoke**

```bash
curl -s https://pellet.network/api/agents
curl -s "https://pellet.network/api/cron/pellet-tick" -H "authorization: Bearer $CRON_SECRET"
```

Expected: agents JSON returns the seeded list; pellet-tick succeeds; the observation shows up at https://pellet.network.

---

## Post-launch — open work

- **Curated agent research pass** — populate `data/curated-agents.ts` with real Tempo wallets (mine `lib/labels.ts` from the archive for entries where `category = 'agent'`; supplement with current research). Re-seed.
- **Event-kind taxonomy** — add `swap`, `mint`, `payment`, etc. to `KIND_BY_TOPIC` in `lib/ingest/matcher.ts` as we identify their topic-0 hashes.
- **Cross-chain Solana coverage (v0.5)** — separate spec + plan. Add a `chain` column to `events` and `agent_events`; introduce `lib/sources/solana/` for parallel ingestion.
- **OLI provenance UI surface** — currently subtle (hover/title attribute). Could be promoted to a per-event detail panel with re-verification instructions (block explorer link + raw event payload).
- **SDK + MCP republish** — port from `pellet-tempo-archive`, retarget to the unified API surface.
- **Stripe billing + paid tiers** — when there's an audience to charge.

---

## Self-review

**Spec coverage check (against `2026-04-29-pellet-oli-design.md`):**
- §3 thesis (Tempo-primary, agent infra) → all tasks
- §5 audience (Tempo-native + CT via clips) → distribution-ready output, no in-product changes needed
- §6 architecture diagram → Tasks 7–10 (DB), 11–13 (ingestion), 15–16 (API), 17 (UI), 18 (cron)
- §7 data model → Task 8 (schema)
- §8 components → Task 17 (UI wiring); aesthetic + glyphs already shipped
- §9 aesthetic → unchanged from prior commits (Iosevka, mono palette, glyphs, slide-in)
- §10 Pellet-the-mascot → Task 14 (seed) + Task 18 (tick cron)
- §11 stack → Tasks 7, 9, 10
- §12 v0 row → all tasks
- §13 open questions → tracked in post-launch section above + research pass note in Task 14
- §14 non-goals → respected throughout

**Placeholder scan:** No TBD/TODO/"add appropriate X". Curated agent list is acknowledged as research-pass work in Task 14 step 1, in spec §13, and in the post-launch section.

**Type consistency:** `FeedRow` (lib/db/agent-events.ts) → `FeedPayload` (api/feed) → `FeedEvent` (event-card.tsx) flow is internally consistent. `AgentLite` (matcher.ts) matches the `listActiveAgents` projection. `RawEventRow` (matcher.ts) matches the SQL projection in `match-runner.ts`.

**Carry-forward integrity:** Tasks 9, 10, 13 explicitly port from `/tmp/pellet-archive/lib/{rpc,ingest/{abi,cron-wrapper,event-processor}}.ts` and the cron route at `app/api/cron/ingest/route.ts`. The archive must be available at clone time — if `/tmp/pellet-archive` is gone, instructions in Task 10 step 2 cover re-cloning.
