import { NextResponse } from "next/server";
import { listMppServices } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ services: await listMppServices() });
}
