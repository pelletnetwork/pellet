import type { Metadata } from "next";
import { CommandBar } from "@/components/oli/CommandBar";
import { SpecimenShell } from "@/components/specimen/SpecimenShell";
import "./oli-theme.css";
import "../specimen/specimen.css";

const OG_DESCRIPTION =
  "Decoded autonomous economic activity on Tempo. Per-event provenance, per-service revenue, per-provider attribution recovered on-chain.";

export const metadata: Metadata = {
  title: {
    default: "Pellet OLI — Open-Ledger Interface for Tempo",
    template: "%s — Pellet OLI",
  },
  description: OG_DESCRIPTION,
  metadataBase: new URL("https://pellet.network"),
  openGraph: {
    title: "Pellet OLI — Open-Ledger Interface for Tempo",
    description: OG_DESCRIPTION,
    url: "https://pellet.network/oli",
    siteName: "Pellet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@pelletnetwork",
    creator: "@pelletnetwork",
    title: "Pellet OLI — Open-Ledger Interface for Tempo",
    description: OG_DESCRIPTION,
  },
};

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <SpecimenShell>
      {children}
      {/* Uncontrolled — CommandBar self-manages its ⌘K hotkey + open state.
          Replaced the fumadocs SearchProvider wrapper that expected a
          dedicated trigger button we don't render on the specimen surface. */}
      <CommandBar />
    </SpecimenShell>
  );
}
