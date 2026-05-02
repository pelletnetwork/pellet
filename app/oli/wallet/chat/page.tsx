import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { recentChatMessages } from "@/lib/db/wallet-chat";
import { SpecimenWalletChat } from "./SpecimenWalletChat";

export const metadata: Metadata = {
  title: "Wallet Chat — Pellet",
  description: "Live chat thread between you and your agents.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletChatPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  // Initial paint: last 50 messages oldest-first so the SSE stream can
  // append in chronological order without re-ordering.
  const recent = (await recentChatMessages(userId, 50)).reverse();

  return (
    <SpecimenWalletChat
      basePath="/oli/wallet"
      initialMessages={recent.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        sender: r.sender,
        kind: r.kind,
        content: r.content,
        intentId: r.intentId,
        ts: r.createdAt.toISOString(),
      }))}
    />
  );
}
