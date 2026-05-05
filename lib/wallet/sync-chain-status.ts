import { db } from "@/lib/db/client";
import { walletSessions } from "@/lib/db/schema";
import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { createClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { tempoActions } from "viem/tempo";
import { privateKeyToAddress } from "viem/accounts";

type SessionRow = typeof walletSessions.$inferSelect;

let cachedClient: ReturnType<typeof buildClient> | null = null;

function buildClient() {
  const chain = tempoChainConfig();
  const viemChain = chain.chainId === tempoMainnet.id ? tempoMainnet : tempoModerato;
  return createClient({ chain: viemChain, transport: http(chain.rpcUrl) }).extend(
    tempoActions(),
  );
}

function getClient() {
  if (!cachedClient) cachedClient = buildClient();
  return cachedClient;
}

async function checkSession(
  session: SessionRow,
  managedAddress: `0x${string}`,
): Promise<void> {
  if (!session.sessionKeyCiphertext) return;

  let agentAddress: `0x${string}`;
  try {
    const pk = decryptSessionKey(Buffer.from(session.sessionKeyCiphertext));
    agentAddress = privateKeyToAddress(pk);
  } catch {
    return;
  }

  const client = getClient();
  try {
    const meta = await client.accessKey.getMetadata({
      account: managedAddress,
      accessKey: agentAddress,
    });
    if (meta.isRevoked) {
      await db
        .update(walletSessions)
        .set({ revokedAt: new Date() })
        .where(eq(walletSessions.id, session.id));
    }
  } catch {
    // Key not found on-chain or RPC unreachable — don't mutate DB on
    // ambiguous failures.
  }
}

export async function syncSessionsChainStatus(
  userId: string,
  managedAddress: string,
): Promise<void> {
  const active = await db
    .select()
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.userId, userId),
        isNull(walletSessions.revokedAt),
        sql`${walletSessions.authorizeTxHash} IS NOT NULL`,
        sql`${walletSessions.expiresAt} > now()`,
      ),
    );
  if (active.length === 0) return;

  const addr = managedAddress as `0x${string}`;
  await Promise.allSettled(active.map((s) => checkSession(s, addr)));
}
