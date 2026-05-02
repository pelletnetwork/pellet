import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { listConnectedAgents } from "@/lib/db/wallet-oauth-tokens";
import { SpecimenConnectedAgents } from "./SpecimenConnectedAgents";

export const metadata: Metadata = {
  title: "Connected Agents — Pellet Wallet",
  description: "Manage the agents authorized to act on your wallet.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletAgentsPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const tokens = await listConnectedAgents(userId);

  return (
    <SpecimenConnectedAgents
      basePath="/oli/wallet"
      agents={tokens.map((t) => ({
        id: t.id,
        clientId: t.clientId,
        clientName: t.clientName,
        clientType: t.clientType,
        scopes: t.scopes,
        audience: t.audience,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      }))}
    />
  );
}
