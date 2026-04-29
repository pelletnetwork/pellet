import { NextResponse } from "next/server";
import { dashboardSnapshot } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_WINDOWS = [24, 168, 720, 8760]; // 24h, 7d, 30d, 1y (used as "all" proxy)

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("windowHours") ?? 24);
  const windowHours = ALLOWED_WINDOWS.includes(raw) ? raw : 24;
  const snap = await dashboardSnapshot(windowHours);
  return NextResponse.json(snap);
}
