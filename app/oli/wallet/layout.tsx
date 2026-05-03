import { headers } from "next/headers";
import { redirect } from "next/navigation";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizeHost(hostHeader: string | null): string {
  const host = (hostHeader ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket >= 0 ? host.slice(0, closingBracket + 1) : host;
  }

  return host.split(":")[0] ?? "";
}

function isLocalHost(hostHeader: string | null): boolean {
  const host = normalizeHost(hostHeader);
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

export default async function OliWalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (!isLocalHost(host)) redirect("/wallet");

  return children;
}
