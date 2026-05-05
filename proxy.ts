import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLocalRequest(request: NextRequest): boolean {
  const host = request.nextUrl.hostname.toLowerCase();
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

function walletSoonRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/wallet", request.url));
}

export function proxy(request: NextRequest) {
  if (isLocalRequest(request)) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/wallet") || pathname.startsWith("/oauth")) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (pathname === "/wallet") return NextResponse.next();
  if (pathname.startsWith("/oli/wallet")) return NextResponse.next();

  return walletSoonRedirect(request);
}

export const config = {
  matcher: [
    "/wallet/:path*",
    "/api/wallet/:path*",
    "/oauth/:path*",
  ],
};
