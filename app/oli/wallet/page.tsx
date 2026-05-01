import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Pellet Wallet",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// `/oli/wallet` always lands on sign-in. Sign-in itself is auth-aware
// (signed-in users get bounced straight to /oli/wallet/dashboard) so
// there's no marketing landing in the flow.
export default function OliWalletRedirect() {
  redirect("/oli/wallet/sign-in");
}
