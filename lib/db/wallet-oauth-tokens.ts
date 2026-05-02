import { and, desc, eq, isNull, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { oauthAccessTokens, oauthClients } from "@/lib/db/schema";
import type { ScopeName } from "@/lib/oauth/scopes";

// Helpers for the connected-agents UI: list a user's active OAuth tokens
// joined to their client metadata (name, type) so the wallet can show
// "Claude Code (test) · 4 scopes · last used 3m ago" rows.

export type ConnectedAgentToken = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: "cimd" | "pre" | "dynamic";
  scopes: ScopeName[];
  audience: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

export async function listConnectedAgents(
  userId: string,
): Promise<ConnectedAgentToken[]> {
  const rows = await db
    .select({
      id: oauthAccessTokens.id,
      clientId: oauthClients.clientId,
      clientName: oauthClients.clientName,
      clientType: oauthClients.clientType,
      scopes: oauthAccessTokens.scopes,
      audience: oauthAccessTokens.audience,
      createdAt: oauthAccessTokens.createdAt,
      expiresAt: oauthAccessTokens.expiresAt,
      lastUsedAt: oauthAccessTokens.lastUsedAt,
    })
    .from(oauthAccessTokens)
    .innerJoin(
      oauthClients,
      eq(oauthAccessTokens.clientId, oauthClients.clientId),
    )
    .where(
      and(
        eq(oauthAccessTokens.userId, userId),
        isNull(oauthAccessTokens.revokedAt),
        gt(oauthAccessTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(oauthAccessTokens.createdAt));

  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: r.clientName,
    clientType: r.clientType as ConnectedAgentToken["clientType"],
    scopes: r.scopes as ScopeName[],
    audience: r.audience,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    lastUsedAt: r.lastUsedAt,
  }));
}
