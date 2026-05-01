import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { SpecimenSignInForm } from "./SpecimenSignInForm";

export const metadata: Metadata = {
  title: "Sign in or create wallet — Pellet",
  description: "Sign in with your passkey, or enroll a fresh passkey to create a new Pellet wallet.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletSignInPage() {
  // Already signed in → straight to the dashboard. Avoids re-auth prompts
  // for users who land on /oli/wallet (which redirects here).
  const userId = await readUserSession();
  if (userId) redirect("/oli/wallet/dashboard");
  return <SpecimenSignInForm basePath="/oli/wallet" />;
}
