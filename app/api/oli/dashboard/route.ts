import { NextResponse } from "next/server";
import { dashboardSnapshot } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await dashboardSnapshot(24);
  return NextResponse.json(snap);
}
