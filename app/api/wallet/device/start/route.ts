import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings } from "@/lib/db/schema";
import { generateCode, generateDeviceId } from "@/lib/wallet/device-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIRING_TTL_SECONDS = 5 * 60; // 5 min

type StartBody = {
  agent_label?: string;
};

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  let body: StartBody = {};
  try {
    body = (await req.json()) as StartBody;
  } catch {
    // empty body is fine
  }

  // Loop a few times in case of code collision (rare with 1M combos + 5min TTL).
  let lastErr: unknown;
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const deviceId = generateDeviceId();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000);

    try {
      const [row] = await db
        .insert(walletDevicePairings)
        .values({
          code,
          deviceId,
          agentLabel: body.agent_label?.slice(0, 80) ?? null,
          expiresAt,
        })
        .returning({ id: walletDevicePairings.id });

      return NextResponse.json({
        code,
        device_id: deviceId,
        approve_url: `${origin}/wallet/device?code=${code}`,
        expires_at: expiresAt.toISOString(),
        poll_interval_seconds: 2,
        pairing_id: row.id,
      });
    } catch (e) {
      lastErr = e;
      // unique-violation on code or device_id — retry with fresh values
    }
  }

  return NextResponse.json(
    { error: "could not allocate pairing", detail: String(lastErr) },
    { status: 500 },
  );
}
