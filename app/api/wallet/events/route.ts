import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletSpendLog } from "@/lib/db/schema";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bearer-auth'd. Returns the user's recent payments from wallet_spend_log.
// Filterable by memo prefix (challenge_id LIKE), time window, and status.
// Pairs the agent-side `pellet_recent_events` MCP tool — the killer use
// case is "did I already settle challenge X?" which is what memo_prefix
// is for. Note: rows persisted before challenge_id was wired through the
// pay route will have null challenge_id and won't match memo_prefix.

const MAX_LIMIT = 100;
const DEFAULT_WINDOW_HOURS = 24;
const STATUS_VALUES = new Set(["any", "submitted", "pending", "failed"] as const);

function normalizeMemoPrefix(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // accept "0x…" or bare hex; store lower-case for ilike match
  return trimmed.toLowerCase();
}

export async function GET(req: Request) {
  const resolved = await requireSession(req);
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const { searchParams } = new URL(req.url);
  const memoPrefix = normalizeMemoPrefix(searchParams.get("memo_prefix"));
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "25", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : 25;
  const sinceRaw = searchParams.get("since");
  let since: Date;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "since must be ISO-8601" },
        { status: 400 },
      );
    }
    since = parsed;
  } else {
    since = new Date(Date.now() - DEFAULT_WINDOW_HOURS * 60 * 60 * 1000);
  }
  const statusRaw = (searchParams.get("status") ?? "submitted") as
    | "any"
    | "submitted"
    | "pending"
    | "failed";
  if (!STATUS_VALUES.has(statusRaw)) {
    return NextResponse.json(
      { error: "status must be one of any|submitted|pending|failed" },
      { status: 400 },
    );
  }

  const conditions = [
    eq(walletSpendLog.userId, user.id),
    gte(walletSpendLog.createdAt, since),
  ];
  if (statusRaw !== "any") {
    conditions.push(eq(walletSpendLog.status, statusRaw));
  }
  if (memoPrefix) {
    conditions.push(ilike(walletSpendLog.challengeId, `${memoPrefix}%`));
  }

  const rows = await db
    .select()
    .from(walletSpendLog)
    .where(and(...conditions))
    .orderBy(desc(walletSpendLog.createdAt))
    .limit(limit);

  const chain = tempoChainConfig();

  const events = rows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    recipient: r.recipient,
    amount_wei: r.amountWei,
    amount_usdc: Number(r.amountWei) / 1_000_000,
    challenge_id: r.challengeId,
    tx_hash: r.txHash,
    explorer_url: r.txHash ? `${chain.explorerUrl}/tx/${r.txHash}` : null,
    status: r.status,
    reason: r.reason,
  }));

  return NextResponse.json({
    ok: true,
    managed_address: user.managedAddress,
    session_id: session.id,
    count: events.length,
    since: since.toISOString(),
    memo_prefix: memoPrefix,
    events,
  });
}
