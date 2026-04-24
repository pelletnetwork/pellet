// Cached server-side feed of recent registry events. The Route Handler
// runs once per `revalidate` window — all visitors share the cached
// payload, so client traffic to HyperEVM's rate-limited public RPC drops
// to zero per page view.
//
// `revalidate = 30` keeps the data fresh enough to feel live while
// staying well below any conceivable RPC budget.

import { NextResponse } from "next/server";

import { getRecentRegistryEvents } from "@/lib/hl/recentEvents";

export const revalidate = 30;
export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await getRecentRegistryEvents("mainnet");
    return NextResponse.json(
      { items, generatedAt: Date.now() },
      {
        headers: {
          // Belt-and-suspenders edge cache hint — Vercel will obey
          // `revalidate` regardless, but this keeps the response cacheable
          // by any intermediate CDN or browser refresh as well.
          "Cache-Control": `public, s-maxage=30, stale-while-revalidate=60`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { items: [], error: (err as Error).message ?? "fetch failed" },
      { status: 500 },
    );
  }
}
