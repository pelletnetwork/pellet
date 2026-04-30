import type { Metadata } from "next";
import { renderSession } from "@/app/wallet/dashboard/sessions/[id]/page";

export const metadata: Metadata = {
  title: "Session — Pellet Wallet",
  description: "Cap-usage history and payment activity for a single agent session.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return renderSession(params, "/oli/wallet");
}
