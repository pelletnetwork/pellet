import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oauthAccessTokens } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wallet/oauth/tokens/[id]/revoke
//
// Cookie-auth'd. Revokes one of the user's OAuth tokens. The token row's
// user_id MUST match the authenticated user — defense against a token-id
// guessing attack from a different signed-in account. Idempotent — already-
// revoked tokens return 200 OK without changing state.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "invalid token id" }, { status: 400 });
  }

  const updated = await db
    .update(oauthAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(oauthAccessTokens.id, id),
        eq(oauthAccessTokens.userId, userId),
      ),
    )
    .returning({ id: oauthAccessTokens.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "token not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id: updated[0].id });
}
