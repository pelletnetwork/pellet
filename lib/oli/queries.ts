import { db } from "@/lib/db/client";
import { agentEvents, agents, addressLabels } from "@/lib/db/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────

export type LeaderboardRow = {
  id: string;
  label: string;
  category: string | null;
  txCount: number;
  amountSumWei: string; // bigint as string
};

export type DashboardSnapshot = {
  windowHours: number;
  txCount: number;
  agentsActive: number;
  amountSumWei: string;
  topServices: LeaderboardRow[];
  topAgents: LeaderboardRow[];
  recentEvents: RecentEventRow[];
};

export type RecentEventRow = {
  id: number;
  ts: Date;
  agentId: string;
  agentLabel: string;
  agentCategory: string | null;
  counterpartyAddress: string | null;
  counterpartyLabel: string | null;
  counterpartyCategory: string | null;
  kind: string;
  amountWei: string | null;
  tokenAddress: string | null;
  txHash: string;
  sourceBlock: number;
  methodologyVersion: string;
};

export type ServiceListRow = {
  id: string;
  label: string;
  category: string;
  txCount24h: number;
  txCount7d: number;
  amountSumWei24h: string;
  amountSumWei7d: string;
  agentsLast7d: number;
  settlementAddress: string;
};

export type AgentListRow = {
  id: string;
  label: string;
  source: string;
  txCount24h: number;
  amountSumWei24h: string;
  topServiceLabel: string | null;
  lastActivity: Date | null;
  walletAddress: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────

const HOURS = (n: number) => sql`now() - (interval '1 hour' * ${n})`;

// ── Queries ──────────────────────────────────────────────────────────────

export async function dashboardSnapshot(windowHours = 24): Promise<DashboardSnapshot> {
  const sinceCutoff = HOURS(windowHours);

  // Aggregate stats.
  const agg = await db.execute<{
    tx_count: string;
    agents_active: string;
    amount_sum_wei: string | null;
  }>(sql`
    SELECT
      COUNT(*)::text                                     AS tx_count,
      COUNT(DISTINCT agent_id)::text                     AS agents_active,
      COALESCE(SUM(amount_wei::numeric), 0)::text        AS amount_sum_wei
    FROM agent_events
    WHERE ts > ${sinceCutoff}
  `);

  const top = agg.rows[0] ?? { tx_count: "0", agents_active: "0", amount_sum_wei: "0" };

  const topServices = await leaderboard("services", windowHours, 10);
  const topAgents = await leaderboard("agents", windowHours, 10);
  const recentEvents = await recentDecoded(25);

  return {
    windowHours,
    txCount: Number(top.tx_count),
    agentsActive: Number(top.agents_active),
    amountSumWei: top.amount_sum_wei ?? "0",
    topServices,
    topAgents,
    recentEvents,
  };
}

export async function leaderboard(
  kind: "services" | "agents",
  windowHours: number,
  limit: number,
): Promise<LeaderboardRow[]> {
  const sinceCutoff = HOURS(windowHours);

  if (kind === "services") {
    // Top services by amount received (mpp_service category in address_labels).
    const rows = await db.execute<{
      id: string;
      label: string;
      category: string;
      tx_count: string;
      amount_sum_wei: string;
    }>(sql`
      SELECT
        a.id                                          AS id,
        a.label                                       AS label,
        (a.links ->> 'category')                      AS category,
        COUNT(*)::text                                AS tx_count,
        COALESCE(SUM(ae.amount_wei::numeric), 0)::text AS amount_sum_wei
      FROM agent_events ae
      JOIN agents a ON a.id = ae.agent_id
      WHERE ae.ts > ${sinceCutoff}
        AND ae.kind = 'transfer'
        AND a.id LIKE '%-mpp'
      GROUP BY a.id, a.label, a.links
      ORDER BY amount_sum_wei DESC
      LIMIT ${limit}
    `);
    return rows.rows.map((r) => ({
      id: r.id,
      label: r.label,
      category: r.category ?? null,
      txCount: Number(r.tx_count),
      amountSumWei: r.amount_sum_wei,
    }));
  }

  // Top "agents" — for v0 we're treating any non-mpp watched entity as an
  // agent. Better long-term: track payer addresses separately. v0 shows
  // services they pay too (top "active" agents by counterparty interaction).
  const rows = await db.execute<{
    id: string;
    label: string;
    tx_count: string;
    amount_sum_wei: string;
  }>(sql`
    SELECT
      a.id                                          AS id,
      a.label                                       AS label,
      COUNT(*)::text                                AS tx_count,
      COALESCE(SUM(ae.amount_wei::numeric), 0)::text AS amount_sum_wei
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    WHERE ae.ts > ${sinceCutoff}
      AND a.id NOT LIKE '%-mpp'
    GROUP BY a.id, a.label
    ORDER BY tx_count DESC
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => ({
    id: r.id,
    label: r.label,
    category: null,
    txCount: Number(r.tx_count),
    amountSumWei: r.amount_sum_wei,
  }));
}

export async function recentDecoded(limit = 25): Promise<RecentEventRow[]> {
  // Join agent_events → agents (for the matched side) AND
  //                  → address_labels via counterparty_address (for the other side).
  const rows = await db.execute<{
    id: number;
    ts: Date;
    agent_id: string;
    agent_label: string;
    agent_category: string | null;
    counterparty_address: string | null;
    counterparty_label: string | null;
    counterparty_category: string | null;
    kind: string;
    amount_wei: string | null;
    token_address: string | null;
    tx_hash: string;
    source_block: number;
    methodology_version: string;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.ts                                   AS ts,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      (a.links ->> 'category')                AS agent_category,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label,
      cl.category                             AS counterparty_category,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.token_address                        AS token_address,
      ae.tx_hash                              AS tx_hash,
      ae.source_block::int                    AS source_block,
      ae.methodology_version                  AS methodology_version
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    ORDER BY ae.ts DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    // Drizzle's db.execute() (raw SQL) returns timestamps as ISO strings via
    // neon-serverless. Coerce to Date here so consumers can call .getTime().
    ts: r.ts instanceof Date ? r.ts : new Date(r.ts as unknown as string),
    agentId: r.agent_id,
    agentLabel: r.agent_label,
    agentCategory: r.agent_category,
    counterpartyAddress: r.counterparty_address,
    counterpartyLabel: r.counterparty_label,
    counterpartyCategory: r.counterparty_category,
    kind: r.kind,
    amountWei: r.amount_wei,
    tokenAddress: r.token_address,
    txHash: r.tx_hash,
    sourceBlock: r.source_block,
    methodologyVersion: r.methodology_version,
  }));
}

export async function listMppServices(): Promise<ServiceListRow[]> {
  // All curated MPP services (id ends in '-mpp') with 24h + 7d aggregates.
  const rows = await db.execute<{
    id: string;
    label: string;
    category: string;
    settlement_address: string;
    tx_count_24h: string;
    tx_count_7d: string;
    amount_sum_wei_24h: string;
    amount_sum_wei_7d: string;
    agents_last_7d: string;
  }>(sql`
    SELECT
      a.id                                          AS id,
      a.label                                       AS label,
      COALESCE(a.links ->> 'category', 'unknown')   AS category,
      COALESCE(a.wallets[1], '')                    AS settlement_address,
      COALESCE((SELECT COUNT(*) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS tx_count_24h,
      COALESCE((SELECT COUNT(*) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '7 days'), 0)::text   AS tx_count_7d,
      COALESCE((SELECT SUM(amount_wei::numeric) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS amount_sum_wei_24h,
      COALESCE((SELECT SUM(amount_wei::numeric) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '7 days'), 0)::text   AS amount_sum_wei_7d,
      COALESCE((SELECT COUNT(DISTINCT counterparty_address)
                FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '7 days'), 0)::text   AS agents_last_7d
    FROM agents a
    WHERE a.active = true AND a.id LIKE '%-mpp'
    ORDER BY amount_sum_wei_24h DESC
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    settlementAddress: r.settlement_address,
    txCount24h: Number(r.tx_count_24h),
    txCount7d: Number(r.tx_count_7d),
    amountSumWei24h: r.amount_sum_wei_24h,
    amountSumWei7d: r.amount_sum_wei_7d,
    agentsLast7d: Number(r.agents_last_7d),
  }));
}

export async function listAgents(): Promise<AgentListRow[]> {
  const rows = await db.execute<{
    id: string;
    label: string;
    source: string;
    wallet_address: string | null;
    tx_count_24h: string;
    amount_sum_wei_24h: string;
    last_activity: Date | null;
    top_service_label: string | null;
  }>(sql`
    SELECT
      a.id, a.label, a.source,
      COALESCE(a.wallets[1], NULL) AS wallet_address,
      COALESCE((SELECT COUNT(*) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS tx_count_24h,
      COALESCE((SELECT SUM(amount_wei::numeric) FROM agent_events ae
                WHERE ae.agent_id = a.id
                  AND ae.ts > now() - interval '24 hours'), 0)::text AS amount_sum_wei_24h,
      (SELECT MAX(ts) FROM agent_events ae WHERE ae.agent_id = a.id)  AS last_activity,
      NULL::text                                                       AS top_service_label
    FROM agents a
    WHERE a.active = true AND a.id NOT LIKE '%-mpp'
    ORDER BY tx_count_24h DESC
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    label: r.label,
    source: r.source,
    walletAddress: r.wallet_address,
    txCount24h: Number(r.tx_count_24h),
    amountSumWei24h: r.amount_sum_wei_24h,
    // Coerce ISO string from raw SQL execute path into Date.
    lastActivity:
      r.last_activity == null
        ? null
        : r.last_activity instanceof Date
          ? r.last_activity
          : new Date(r.last_activity as unknown as string),
    topServiceLabel: r.top_service_label,
  }));
}

export async function serviceDetail(id: string) {
  // Raw SQL columns come back snake_case; we map to camelCase below to match
  // RecentEventRow's expected shape (downstream EventStream calls e.txHash etc.).
  const recent = await db.execute<{
    id: number;
    ts: Date;
    agent_id: string;
    agent_label: string;
    agent_category: string | null;
    counterparty_address: string | null;
    counterparty_label: string | null;
    counterparty_category: string | null;
    kind: string;
    amount_wei: string | null;
    token_address: string | null;
    tx_hash: string;
    source_block: number;
    methodology_version: string;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.ts                                   AS ts,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      (a.links ->> 'category')                AS agent_category,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label,
      cl.category                             AS counterparty_category,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.token_address                        AS token_address,
      ae.tx_hash                              AS tx_hash,
      ae.source_block::int                    AS source_block,
      ae.methodology_version                  AS methodology_version
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    WHERE ae.agent_id = ${id}
    ORDER BY ae.ts DESC
    LIMIT 50
  `);

  const trend = await db.execute<{ bucket: Date; amount_wei: string; tx_count: string }>(sql`
    SELECT
      date_trunc('hour', ts) AS bucket,
      COALESCE(SUM(amount_wei::numeric), 0)::text AS amount_wei,
      COUNT(*)::text AS tx_count
    FROM agent_events
    WHERE agent_id = ${id}
      AND ts > now() - interval '30 days'
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  const head = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  return {
    head: head[0] ?? null,
    // Map snake_case → camelCase to match the RecentEventRow shape downstream
    // consumers (EventStream + decoder) expect. Also coerce ts string → Date.
    recent: recent.rows.map((r) => ({
      id: r.id,
      ts: r.ts instanceof Date ? r.ts : new Date(r.ts as unknown as string),
      agentId: r.agent_id,
      agentLabel: r.agent_label,
      agentCategory: r.agent_category,
      counterpartyAddress: r.counterparty_address,
      counterpartyLabel: r.counterparty_label,
      counterpartyCategory: r.counterparty_category,
      kind: r.kind,
      amountWei: r.amount_wei,
      tokenAddress: r.token_address,
      txHash: r.tx_hash,
      sourceBlock: r.source_block,
      methodologyVersion: r.methodology_version,
    })),
    trend: trend.rows.map((r) => ({
      bucket: r.bucket instanceof Date ? r.bucket : new Date(r.bucket as unknown as string),
      amountWei: r.amount_wei,
      txCount: Number(r.tx_count),
    })),
  };
}

export async function agentDetail(id: string) {
  return serviceDetail(id); // same query shape — different page presentation
}
