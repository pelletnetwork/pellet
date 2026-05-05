import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletSessions, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import { eq, and } from "drizzle-orm";
import { privateKeyToAddress } from "viem/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "session id required" }, { status: 400 });
  }

  const sessionRows = await db
    .select()
    .from(walletSessions)
    .where(and(eq(walletSessions.id, id), eq(walletSessions.userId, userId)))
    .limit(1);
  const session = sessionRows[0];
  if (!session) {
    return NextResponse.json(
      { error: "session not found or not owned by you" },
      { status: 404 },
    );
  }

  await db
    .update(walletSessions)
    .set({ revokedAt: new Date() })
    .where(eq(walletSessions.id, session.id));

  // Return on-chain revoke material so the browser can send a passkey-signed
  // AccountKeychain.revokeKey transaction. Best-effort: if anything here
  // fails, the DB revoke already blocks server-side payments.
  let onChain: {
    agent_key_address: string;
    credential_id: string;
    public_key_uncompressed: string;
    managed_address: string;
    chain_id: number;
    rpc_url: string;
    sponsor_url: string | null;
    usdc_e: string;
    rp_id: string;
  } | null = null;

  if (session.authorizeTxHash && session.sessionKeyCiphertext) {
    try {
      const agentPk = decryptSessionKey(Buffer.from(session.sessionKeyCiphertext));
      const agentAddress = privateKeyToAddress(agentPk);

      const userRows = await db
        .select({
          managedAddress: walletUsers.managedAddress,
          publicKeyUncompressed: walletUsers.publicKeyUncompressed,
          passkeyCredentialId: walletUsers.passkeyCredentialId,
        })
        .from(walletUsers)
        .where(eq(walletUsers.id, userId))
        .limit(1);
      const user = userRows[0];

      if (user?.publicKeyUncompressed && user?.passkeyCredentialId) {
        const chain = tempoChainConfig();
        onChain = {
          agent_key_address: agentAddress,
          credential_id: user.passkeyCredentialId,
          public_key_uncompressed: user.publicKeyUncompressed,
          managed_address: user.managedAddress,
          chain_id: chain.chainId,
          rpc_url: chain.rpcUrl,
          sponsor_url: chain.sponsorUrl,
          usdc_e: chain.usdcE,
          rp_id: process.env.NEXT_PUBLIC_RP_ID ?? "pellet.network",
        };
      }
    } catch (e) {
      console.error("[session/revoke] could not derive agent key address:", e);
    }
  }

  return NextResponse.json({ ok: true, on_chain: onChain });
}
