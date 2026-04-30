import type { Metadata } from "next";
import { renderSettings } from "@/app/wallet/dashboard/settings/page";

export const metadata: Metadata = {
  title: "Settings — Pellet Wallet",
  description: "Passkey identity, session management, and account controls.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletSettingsPage() {
  return renderSettings("/oli/wallet");
}
