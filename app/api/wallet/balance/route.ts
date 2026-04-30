import { NextResponse } from "next/server";
import { requireSession } from "@/lib/wallet/bearer-auth";
import { readWalletBalances } from "@/lib/wallet/tempo-balance";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bearer-auth'd. Returns the wallet's on-chain balances + the session's
// remaining spend cap so an agent can answer "can I afford to pay X?" in
// one call. Pairs the agent-side `pellet_balance` MCP tool.

export async function GET(req: Request) {
  const resolved = await requireSession(req);
  if (resolved instanceof NextResponse) return resolved;
  const { session, user } = resolved;

  const chain = tempoChainConfig();
  const balances = await readWalletBalances(user.managedAddress as `0x${string}`);

  const spendCapWei = BigInt(session.spendCapWei);
  const spendUsedWei = BigInt(session.spendUsedWei);
  const remainingWei = spendCapWei > spendUsedWei ? spendCapWei - spendUsedWei : BigInt(0);

  return NextResponse.json({
    ok: true,
    managed_address: user.managedAddress,
    chain: chain.name,
    chain_id: chain.chainId,
    balances: balances.map((b) => ({
      symbol: b.symbol,
      address: b.address,
      raw_wei: b.raw.toString(),
      display: b.display,
    })),
    session: {
      label: session.label,
      spend_cap_wei: spendCapWei.toString(),
      spend_used_wei: spendUsedWei.toString(),
      remaining_wei: remainingWei.toString(),
      per_call_cap_wei: session.perCallCapWei,
      expires_at: session.expiresAt.toISOString(),
    },
  });
}
