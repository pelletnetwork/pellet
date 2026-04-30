import type { Metadata } from "next";
import WalletPage from "@/app/wallet/page";

export const metadata: Metadata = {
  title: "Pellet Wallet",
  description:
    "An open agent wallet on Tempo. Public ledger. Self-custody. Every payment recorded for anyone to read.",
};

// Renders the canonical /wallet landing inside the OLI shell so visitors
// browsing OLI can read the wallet pitch without losing the OLI sidebar
// context. The component is shared with /wallet — single source of truth.
export default function OliEmbeddedWalletPage() {
  return <WalletPage />;
}
