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

  // status === 'approved' — first poll after browser approval. Mint the bearer,
  // create the wallet_session, mark claimed. This block runs at most once per
  // pairing because the next poll will see 'claimed'.
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
  const sessionExpiresAt = new Date(
    Date.now() + pairing.approvedSessionTtlSeconds * 1000,
  );

  await db.transaction(async (tx) => {
    await tx.insert(walletSessions).values({
      userId: pairing.approvedUserId!,
      bearerTokenHash: hash,
      spendCapWei: pairing.approvedSpendCapWei!,
      perCallCapWei: pairing.approvedPerCallCapWei!,
      label: pairing.agentLabel,
      expiresAt: sessionExpiresAt,
    });

    await tx
      .update(walletDevicePairings)
      .set({ status: "claimed", claimedAt: new Date(), bearerTokenHash: hash })
      .where(eq(walletDevicePairings.id, pairing.id));
  });

  return NextResponse.json({
    status: "approved",
    bearer_token: token,
    session_expires_at: sessionExpiresAt.toISOString(),
    spend_cap_wei: pairing.approvedSpendCapWei,
    per_call_cap_wei: pairing.approvedPerCallCapWei,
    label: pairing.agentLabel,
  });
}
