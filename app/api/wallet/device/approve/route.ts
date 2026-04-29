import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 1 PLACEHOLDER. In step 3 this endpoint is gated behind a passkey
// assertion + an AccountKeychain.authorizeKey tx. For now it just marks
// the pairing approved with the chosen caps so the CLI poll loop can be
// exercised end-to-end on testnet without real funds at risk.
//
// Creates a placeholder wallet_users row keyed to a synthetic credential
// so the wallet_session foreign key is satisfied. Real users replace this
// row when they actually enroll a passkey in step 3.

type ApproveBody = {
  code: string;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
};

export async function POST(req: Request) {
  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.code || !body.spend_cap_wei || !body.per_call_cap_wei || !body.session_ttl_seconds) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

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

  // PLACEHOLDER user. In step 3 this is replaced by the real passkey-enrolled
  // user. For now we create a per-pairing throwaway user so the foreign keys
  // line up; the managed_address is a deterministic non-real address.
  const placeholderCredId = `placeholder-${pairing.id}`;
  const placeholderAddress = `0x0000000000000000000000000000${pairing.id.replace(/-/g, "").slice(0, 12)}`;
  const [user] = await db
    .insert(walletUsers)
    .values({
      passkeyCredentialId: placeholderCredId,
      passkeyPublicKey: Buffer.from([]), // empty placeholder; step 3 fills this
      managedAddress: placeholderAddress.toLowerCase(),
      displayName: "phase-1 placeholder",
    })
    .returning({ id: walletUsers.id });

  await db
    .update(walletDevicePairings)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedUserId: user.id,
      approvedSpendCapWei: body.spend_cap_wei,
      approvedPerCallCapWei: body.per_call_cap_wei,
      approvedSessionTtlSeconds: body.session_ttl_seconds,
    })
    .where(eq(walletDevicePairings.id, pairing.id));

  return NextResponse.json({ ok: true });
}
