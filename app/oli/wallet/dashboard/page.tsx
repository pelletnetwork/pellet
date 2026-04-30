import type { Metadata } from "next";
import { renderDashboard } from "@/app/wallet/dashboard/page";

export const metadata: Metadata = {
  title: "Wallet Dashboard — Pellet",
  description: "Your Pellet Wallet — managed Tempo address, active agent sessions, payment history.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletDashboardPage() {
  return renderDashboard("/oli/wallet");
}
