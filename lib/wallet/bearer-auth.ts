import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq, isNull, isNotNull, gt, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { walletSessions, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";

// Shared bearer-token → session resolver for wallet-scoped API routes.
// Mirrors the auth steps from /api/wallet/pay so we don't duplicate the
// 401/403 ladder across every read-side route.

export type WalletSessionRow = typeof walletSessions.$inferSelect;
export type WalletUserRow = typeof walletUsers.$inferSelect;

export type ResolvedSession = {
  session: WalletSessionRow;
  user: Pick<WalletUserRow, "id" | "managedAddress" | "publicKeyUncompressed">;
};

function bearerFromHeader(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer (.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Resolve a bearer-token-authenticated wallet session, or a NextResponse
 * carrying the appropriate 401/403 status to return verbatim. Routes call
 * this and either continue with the resolved {session, user} or `return`
 * the response.
 *
 * The "must be on-chain authorized" check is intentionally optional —
 * read-side routes (balance, events) don't require an authorize tx; only
 * the pay route does.
 */
export async function requireSession(
  req: Request,
  opts: { requireOnChainAuthorize?: boolean } = {},
): Promise<ResolvedSession | NextResponse> {
  const bearer = bearerFromHeader(req);
  if (!bearer) {
    return NextResponse.json(
      { error: "missing bearer token", detail: "Authorization: Bearer <token>" },
      { status: 401 },
    );
  }
  const bearerHash = sha256Hex(bearer);
  const rows = await db
    .select()
    .from(walletSessions)
    .where(eq(walletSessions.bearerTokenHash, bearerHash))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return NextResponse.json({ error: "invalid bearer" }, { status: 401 });
  }
  if (session.revokedAt) {
    return NextResponse.json({ error: "session revoked" }, { status: 403 });
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "session expired" }, { status: 403 });
  }
  if (opts.requireOnChainAuthorize && !session.authorizeTxHash) {
    return NextResponse.json(
      { error: "session not yet on-chain authorized" },
      { status: 403 },
    );
  }

  const userRows = await db
    .select({
      id: walletUsers.id,
      managedAddress: walletUsers.managedAddress,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
    })
    .from(walletUsers)
    .where(eq(walletUsers.id, session.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return NextResponse.json(
      { error: "wallet user missing" },
      { status: 500 },
    );
  }

  return { session, user };
}

export async function requireSessionOrCookie(
  req: Request,
  opts: { requireOnChainAuthorize?: boolean } = {},
): Promise<ResolvedSession | NextResponse> {
  const bearer = bearerFromHeader(req);
  if (bearer) return requireSession(req, opts);

  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const userRows = await db
    .select({
      id: walletUsers.id,
      managedAddress: walletUsers.managedAddress,
      publicKeyUncompressed: walletUsers.publicKeyUncompressed,
    })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "wallet user missing" }, { status: 500 });
  }

  const sessionRows = await db
    .select()
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.userId, userId),
        isNull(walletSessions.revokedAt),
        isNotNull(walletSessions.authorizeTxHash),
        gt(walletSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(walletSessions.createdAt))
    .limit(1);
  const session = sessionRows[0];
  if (!session) {
    return NextResponse.json(
      { error: "no active authorized session" },
      { status: 403 },
    );
  }

  return { session, user };
}
