import type { Metadata } from "next";
import { SpecimenSignInForm } from "./SpecimenSignInForm";

export const metadata: Metadata = {
  title: "Sign in or create wallet — Pellet",
  description: "Sign in with your passkey, or enroll a fresh passkey to create a new Pellet wallet.",
};

export const dynamic = "force-dynamic";

export default function OliWalletSignInPage() {
  return <SpecimenSignInForm basePath="/oli/wallet" />;
}
