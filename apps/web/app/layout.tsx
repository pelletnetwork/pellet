import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pellet — Agent Infrastructure for Hyperliquid",
  description:
    "Identity, execution, accountability for autonomous agents trading on Hyperliquid. ERC-8004 registries, block-pinned receipts, builder-coded execution.",
  openGraph: {
    title: "Pellet — Agent Infrastructure for Hyperliquid",
    description:
      "Identity, execution, accountability for autonomous agents trading on Hyperliquid.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pellet — Agent Infrastructure for Hyperliquid",
    description:
      "Identity, execution, accountability for autonomous agents trading on Hyperliquid.",
    site: "@pelletinfra",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
