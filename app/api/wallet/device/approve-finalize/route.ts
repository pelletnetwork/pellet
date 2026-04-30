import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletSessions, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import {
  ACCOUNT_KEYCHAIN_ADDRESS,
  tempoChainConfig,
} from "@/lib/wallet/tempo-config";
import { createPublicClient, decodeEventLog, http, parseAbiItem } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 3.B.3 — the browser has just completed the passkey-signed
// authorizeKey TempoTransaction. We fetch the receipt from chain and
// independently verify (1) it succeeded, (2) it called the
// AccountKeychain precompile, (3) sender matches the user's managed
// address. Defends against a malicious browser POSTing a forged tx hash
// to obtain a bearer for an unauthorized agent key.

type FinalizeBody = {
  code: string;
  tx_hash: string;
};

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.code || !body.tx_hash) {
    return NextResponse.json({ error: "missing code or tx_hash" }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(body.tx_hash)) {
    return NextResponse.json({ error: "tx_hash must be 0x + 64 hex" }, { status: 400 });
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
  if (pairing.approvedUserId !== userId) {
    return NextResponse.json(
      { error: "pairing was initialized by a different user" },
      { status: 403 },
    );
  }

  // Lookup user's managed address for sender verification.
  const userRows = await db
    .select({ managedAddress: walletUsers.managedAddress })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const expectedSender = userRows[0]?.managedAddress?.toLowerCase();
  if (!expectedSender) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Fetch + verify the receipt from chain. Polls briefly because tx may
  // not be included yet at first call (Tempo finality is ~0.6s but RPC
  // propagation can lag).
  const chain = tempoChainConfig();
  const viemChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(chain.rpcUrl),
  });

  let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>> | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      receipt = await publicClient.getTransactionReceipt({
        hash: body.tx_hash as `0x${string}`,
      });
      break;
    } catch {
      // not yet included; back off briefly
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!receipt) {
    return NextResponse.json(
      { error: "tx not found on chain after 5 polls" },
      { status: 404 },
    );
  }
  if (receipt.status !== "success") {
    return NextResponse.json(
      { error: `tx reverted on-chain (status=${receipt.status})` },
      { status: 400 },
    );
  }

  // Tempo's type-0x76 TempoTransaction with feePayer:true (sponsored gas) does
  // NOT put the AccountKeychain in `receipt.to` — that field is the zero
  // address for typed envelopes. The precompile invocation is visible in
  // `receipt.logs` instead. We verify two things from the logs:
  //   1. AccountKeychain emitted a KeyAuthorized event in this tx
  //   2. The event's `account` (the SCA that authorized the key) matches the
  //      authenticated user's managed address
  // Together this proves the tx actually authorized a key on the right
  // account, regardless of what `to`/`from` look like in the outer envelope.
  const keyAuthorizedEvent = parseAbiItem(
    "event KeyAuthorized(address indexed account, address indexed publicKey, uint8 signatureType, uint64 expiry)",
  );
  let authorizedAccount: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ACCOUNT_KEYCHAIN_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [keyAuthorizedEvent],
        topics: log.topics,
        data: log.data,
      });
      if (decoded.eventName === "KeyAuthorized") {
        authorizedAccount = decoded.args.account.toLowerCase();
        break;
      }
    } catch {
      // Not a KeyAuthorized log; keep scanning.
    }
  }
  if (!authorizedAccount) {
    return NextResponse.json(
      {
        error: "no KeyAuthorized event from AccountKeychain in this tx",
        detail: `tx=${body.tx_hash}, logs=${receipt.logs.length}, precompile=${ACCOUNT_KEYCHAIN_ADDRESS}`,
      },
      { status: 400 },
    );
  }
  if (authorizedAccount !== expectedSender) {
    return NextResponse.json(
      {
        error: "authorized account doesn't match the authenticated user",
        detail: `authorized=${authorizedAccount}, expected=${expectedSender}`,
      },
      { status: 400 },
    );
  }

  // All checks passed. Mark the session + pairing as truly approved.
  const sentinel = `pending-${pairing.id}`;
  await db
    .update(walletSessions)
    .set({
      authorizeTxHash: body.tx_hash,
      onChainAuthorizedAt: new Date(),
    })
    .where(
      and(
        eq(walletSessions.bearerTokenHash, sentinel),
        eq(walletSessions.userId, userId),
      ),
    );

  await db
    .update(walletDevicePairings)
    .set({
      status: "approved",
      approvedAt: new Date(),
    })
    .where(eq(walletDevicePairings.id, pairing.id));

  return NextResponse.json({
    ok: true,
    block_number: receipt.blockNumber.toString(),
    gas_used: receipt.gasUsed.toString(),
  });
}
