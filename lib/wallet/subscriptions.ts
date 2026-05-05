import { db } from "@/lib/db/client";
import { walletSubscriptions, walletAgentConnections } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { platformFeeConfig } from "./tempo-config";

const PRO_FEE_BPS = 25;

export type ActiveSubscription = {
  id: string;
  plan: string;
  expiresAt: Date;
};

export async function getActiveSubscription(
  userId: string,
): Promise<ActiveSubscription | null> {
  const rows = await db
    .select({
      id: walletSubscriptions.id,
      plan: walletSubscriptions.plan,
      expiresAt: walletSubscriptions.expiresAt,
    })
    .from(walletSubscriptions)
    .where(
      and(
        eq(walletSubscriptions.userId, userId),
        sql`${walletSubscriptions.expiresAt} > now()`,
      ),
    )
    .orderBy(sql`${walletSubscriptions.expiresAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

export async function countActiveAgentConnections(
  userId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(walletAgentConnections)
    .where(
      and(
        eq(walletAgentConnections.userId, userId),
        isNull(walletAgentConnections.revokedAt),
      ),
    );
  return result[0]?.count ?? 0;
}

export async function resolveFeeBps(userId: string): Promise<number> {
  const feeConfig = platformFeeConfig();
  if (!feeConfig.enabled) return 0;
  const sub = await getActiveSubscription(userId);
  if (sub) return PRO_FEE_BPS;
  return feeConfig.bps;
}
