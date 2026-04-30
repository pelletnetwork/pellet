import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletSessions } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { and, eq, isNull, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Revoke every active (non-revoked, non-expired) session for the caller in
// one statement. Mirrors single-session revoke semantics: bearer dies
// server-side immediately; on-chain access keys still expire on schedule.

export async function POST() {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const result = await db
    .update(walletSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(walletSessions.userId, userId),
        isNull(walletSessions.revokedAt),
        sql`${walletSessions.expiresAt} > now()`,
      ),
    )
    .returning({ id: walletSessions.id });

  return NextResponse.json({ revoked: result.length });
}
