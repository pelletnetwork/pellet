import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// `/wallet` legacy marketing landing has been retired. Anyone hitting
// pellet.network/wallet now goes straight to the OLI sign-in surface.
export default function WalletLegacyRedirect() {
  redirect("/oli/wallet/sign-in");
}
