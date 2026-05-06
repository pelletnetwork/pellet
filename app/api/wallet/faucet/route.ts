import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { tempoChainConfig, defaultTempoChainId, TEMPO_CHAIN_IDS } from "@/lib/wallet/tempo-config";

const DRIP_AMOUNT = "10000000";

export async function POST() {
  const chain = tempoChainConfig();

  if (defaultTempoChainId() !== TEMPO_CHAIN_IDS.MODERATO_TESTNET) {
    return NextResponse.json(
      { error: "Faucet is testnet-only" },
      { status: 403 },
    );
  }

  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await db
    .select({ managedAddress: walletUsers.managedAddress })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1)
    .then((r) => r[0]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const res = await fetch(chain.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tempo_fundAddress",
        params: [user.managedAddress, DRIP_AMOUNT],
      }),
    });

    const body = await res.json();

    if (body.error) {
      return NextResponse.json(
        { error: "Faucet RPC failed", detail: body.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      address: user.managedAddress,
      amount: DRIP_AMOUNT,
      txHash: body.result,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Faucet request failed", detail: e.message },
      { status: 502 },
    );
  }
}
