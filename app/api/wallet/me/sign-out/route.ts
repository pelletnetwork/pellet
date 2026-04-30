import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/wallet/challenge-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clears the user-session cookie. Sessions and on-chain keys are untouched —
// this just signs the browser out. To revoke agent access use /sessions/revoke-all.

export async function POST() {
  await clearUserSession();
  return NextResponse.json({ ok: true });
}
