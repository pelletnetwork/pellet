import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletSessions } from "@/lib/db/schema";
import { generateBearer } from "@/lib/wallet/device-code";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CLI polls this until status flips from 'pending' to 'approved'. We
// materialize the bearer token + the wallet_session row exactly once on
// first claim, then mark 'claimed' so a subsequent poll returns the
// already-claimed state without re-issuing.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");
  if (!deviceId) {
    return NextResponse.json({ error: "device_id required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(walletDevicePairings)
    .where(eq(walletDevicePairings.deviceId, deviceId))
    .limit(1);

  const pairing = rows[0];
  if (!pairing) {
    return NextResponse.json({ error: "pairing not found" }, { status: 404 });
  }

  // TTL check
  if (pairing.status === "pending" && pairing.expiresAt.getTime() < Date.now()) {
    await db
      .update(walletDevicePairings)
      .set({ status: "expired" })
      .where(eq(walletDevicePairings.id, pairing.id));
    return NextResponse.json({ status: "expired" });
  }

  if (pairing.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  if (pairing.status === "expired") {
    return NextResponse.json({ status: "expired" });
  }

  if (pairing.status === "claimed") {
    // Bearer was already returned to a previous poll; we never return it twice.
    return NextResponse.json({ status: "claimed" });
  }

  // status === 'approved' — first poll after browser approval. The
  // wallet_session row was pre-created in /approve with a sentinel bearer
  // hash and the encrypted session-key ciphertext. We mint the real bearer
  // now, replace the sentinel, and mark the pairing claimed. Runs at most
  // once per pairing.
  if (
    !pairing.approvedUserId ||
    !pairing.approvedSpendCapWei ||
    !pairing.approvedPerCallCapWei ||
    !pairing.approvedSessionTtlSeconds
  ) {
    return NextResponse.json(
      { error: "approval missing required fields" },
      { status: 500 },
    );
  }

  const { token, hash } = generateBearer();
  const sentinelHash = `pending-${pairing.id}`;

  await db.transaction(async (tx) => {
    // Find the pre-created session row (sentinel bearer) and finalize it.
    const updated = await tx
      .update(walletSessions)
      .set({ bearerTokenHash: hash })
      .where(eq(walletSessions.bearerTokenHash, sentinelHash))
      .returning({ id: walletSessions.id, expiresAt: walletSessions.expiresAt });

    if (updated.length === 0) {
      // Defensive: if /approve didn't pre-create (older pairing pre-3.A),
      // fall through to creating a fresh session row without ciphertext.
      // This branch should be unreachable for new pairings.
      await tx.insert(walletSessions).values({
        userId: pairing.approvedUserId!,
        bearerTokenHash: hash,
        spendCapWei: pairing.approvedSpendCapWei!,
        perCallCapWei: pairing.approvedPerCallCapWei!,
        label: pairing.agentLabel,
        expiresAt: new Date(Date.now() + pairing.approvedSessionTtlSeconds! * 1000),
      });
    }

    await tx
      .update(walletDevicePairings)
      .set({ status: "claimed", claimedAt: new Date(), bearerTokenHash: hash })
      .where(eq(walletDevicePairings.id, pairing.id));
  });

  // Look up the finalized session for the response (we want its real expiry).
  const sessionRows = await db
    .select()
    .from(walletSessions)
    .where(eq(walletSessions.bearerTokenHash, hash))
    .limit(1);
  const session = sessionRows[0];
  const sessionExpiresAt =
    session?.expiresAt ?? new Date(Date.now() + pairing.approvedSessionTtlSeconds * 1000);

  return NextResponse.json({
    status: "approved",
    bearer_token: token,
    session_expires_at: sessionExpiresAt.toISOString(),
    spend_cap_wei: pairing.approvedSpendCapWei,
    per_call_cap_wei: pairing.approvedPerCallCapWei,
    label: pairing.agentLabel,
  });
}
