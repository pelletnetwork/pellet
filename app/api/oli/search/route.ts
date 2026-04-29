import { NextResponse } from "next/server";
import { searchOli } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const hits = await searchOli(q);
  return NextResponse.json({ hits });
}
