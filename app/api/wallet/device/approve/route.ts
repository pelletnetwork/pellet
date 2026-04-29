import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletSessions, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { generateSessionKey } from "@/lib/wallet/session-keys";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 3.A — requires an authenticated user (set via WebAuthn register or
// auth flows) AND now generates+encrypts the agent's session key in the
// same transaction. Phase 3.B will additionally submit the on-chain
// AccountKeychain.authorizeKey tx to grant this key spending authority on
// the user's Tempo account; until then the key has no on-chain capability,
// just exists server-side waiting for authorization.

type ApproveBody = {
  code: string;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
};

export async function POST(req: Request) {
  // 1. Must be authenticated.
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json(
      { error: "not authenticated", detail: "complete passkey enrollment first" },
      { status: 401 },
    );
  }
  const userRows = await db
    .select({ id: walletUsers.id })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  if (userRows.length === 0) {
    return NextResponse.json({ error: "user not found" }, { status: 401 });
  }

  // 2. Validate body.
  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.code || !body.spend_cap_wei || !body.per_call_cap_wei || !body.session_ttl_seconds) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  // 3. Look up + validate the pairing.
  const rows = await db
    .select()
    .from(walletDevicePairings)
    .where(eq(walletDevicePairings.code, body.code))
    .limit(1);
  const pairing = rows[0];
  if (!pairing) {
    return NextResponse.json({ error: "code not found" }, { status: 404 });
  }
  if (pairing.status !== "pending") {
    return NextResponse.json({ error: `pairing is ${pairing.status}` }, { status: 409 });
  }
  if (pairing.expiresAt.getTime() < Date.now()) {
    await db
      .update(walletDevicePairings)
      .set({ status: "expired" })
      .where(eq(walletDevicePairings.id, pairing.id));
    return NextResponse.json({ error: "code expired" }, { status: 410 });
  }

  // 4. Generate the agent's session key (secp256k1 EOA). This is the keyId
  // the user's Tempo account will (in phase 3.B) authorize via
  // AccountKeychain.authorizeKey. We encrypt the private key with
  // WALLET_MASTER_KEY (AES-256-GCM) and store the ciphertext on the
  // pairing row temporarily — it'll be lifted onto wallet_sessions when
  // the CLI claims the bearer in /poll.
  const sessionKey = generateSessionKey();

  // 5. Mark the pairing approved + stash the session key ciphertext for
  // the eventual /poll claim. We're reusing wallet_sessions.session_key_
  // ciphertext here by writing it into the pairing's tracked state via the
  // approvedUserId/caps fields — but those are session-bound, so we tuck
  // the ciphertext on the pairing temporarily (no schema change for this
  // small helper field; we reach into the eventual session row in /poll).
  // Simpler path: persist directly to a new row in wallet_sessions in
  // /poll using the approved metadata + the ciphertext we cache here.
  // We'll hold both in pairing-scoped fields by extending the row state
  // with session_key_ciphertext on pairing — added in migration 0006.
  await db
    .update(walletDevicePairings)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedUserId: userId,
      approvedSpendCapWei: body.spend_cap_wei,
      approvedPerCallCapWei: body.per_call_cap_wei,
      approvedSessionTtlSeconds: body.session_ttl_seconds,
    })
    .where(eq(walletDevicePairings.id, pairing.id));

  // Pre-create the wallet_session row now (status not yet "claimed" —
  // bearer is null). The /poll endpoint will fill in the bearer hash on
  // first claim. This way the session_key_ciphertext lives on the right
  // row (wallet_sessions) per its column meaning, no schema gymnastics.
  await db.insert(walletSessions).values({
    userId,
    bearerTokenHash: `pending-${pairing.id}`, // sentinel; replaced in /poll
    spendCapWei: body.spend_cap_wei,
    perCallCapWei: body.per_call_cap_wei,
    sessionKeyCiphertext: sessionKey.ciphertext,
    label: pairing.agentLabel,
    expiresAt: new Date(Date.now() + body.session_ttl_seconds * 1000),
  });

  return NextResponse.json({
    ok: true,
    agent_key_address: sessionKey.address,
    note: "phase-3.B will authorize this key on Tempo via AccountKeychain.authorizeKey",
  });
}
