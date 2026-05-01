import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import {
  loadDashboardData,
  type DashboardData,
} from "@/lib/wallet/dashboard-data";
import { SpecimenWalletDashboard } from "./SpecimenWalletDashboard";

export const metadata: Metadata = {
  title: "Wallet Dashboard — Pellet",
  description: "Your Pellet Wallet — managed Tempo address, active agent sessions, payment history.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const data = await loadDashboardData(userId);
  if (!data) redirect("/oli/wallet/sign-in");

  // Demo mode — only available in non-production builds. Used for
  // marketing screenshots; fakes a populated wallet without writing to
  // the DB. Real on-chain balance + on-chain sessions are untouched.
  const sp = await searchParams;
  const display =
    sp.demo === "1" && process.env.NODE_ENV !== "production"
      ? withDemoOverlay(data)
      : data;

  return (
    <SpecimenWalletDashboard
      user={display.user}
      balances={display.balances}
      chart={display.chart}
      sessions={display.sessions}
      payments={display.payments}
      basePath="/oli/wallet"
    />
  );
}

function withDemoOverlay(real: DashboardData): DashboardData {
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const ahead = (ms: number) => new Date(now + ms).toISOString();

  return {
    ...real,
    balances: [
      {
        symbol: "USDC.e",
        address: "0x20c000000000000000000000b9537d11c60e8b50",
        display: "21843.00",
        rawWei: "21843000000",
      },
      {
        symbol: "USDT0",
        address: "0x20c00000000000000000000014f22ca97301eb73",
        display: "127.40",
        rawWei: "127400000",
      },
    ],
    sessions: [
      {
        id: "5d3a2c10-9f44-41cc-ba45-5df565d4f500",
        label: "cli-mac",
        spendCapWei: "5000000000",
        spendUsedWei: "1840000000",
        perCallCapWei: "500000",
        expiresAt: ahead(7 * 24 * 3600 * 1000 - 6 * 3600 * 1000),
        revokedAt: null,
        authorizeTxHash: "0x9f3aaa10d2d22b0bb5ce1d82ff77c3e9c1b1aa44d3f0e6b8a2e9c10b2233d501",
        createdAt: ago(6 * 3600 * 1000),
      },
      {
        id: "a8f1de42-3b21-4099-87ee-2a40d80b9c12",
        label: "mcp-srv",
        spendCapWei: "1000000000",
        spendUsedWei: "240000000",
        perCallCapWei: "1000000",
        expiresAt: ahead(5 * 24 * 3600 * 1000),
        revokedAt: null,
        authorizeTxHash: "0xdef0ab12cd34ef567890aa11bb22cc33dd44ee55ff6677889900aabbccddeeff",
        createdAt: ago(2 * 24 * 3600 * 1000),
      },
    ],
    payments: [
      {
        id: "demo-p1",
        sessionId: "5d3a2c10-9f44-41cc-ba45-5df565d4f500",
        recipient: "0x7169023145ab40c81e3ff0011223344556676888",
        amountWei: "14000",
        txHash: "0xa14e8800ff112233445566778899aabbccddeeff00112233445566778899aa7c",
        status: "signed",
        createdAt: ago(2 * 60 * 1000),
      },
      {
        id: "demo-p2",
        sessionId: "5d3a2c10-9f44-41cc-ba45-5df565d4f500",
        recipient: "0xc302aabbccddeeff00112233445566778899ab14",
        amountWei: "8750000",
        txHash: "0xc302c30200112233445566778899aabbccddeeff00112233445566778899ab14",
        status: "signed",
        createdAt: ago(38 * 60 * 1000),
      },
      {
        id: "demo-p3",
        sessionId: "a8f1de42-3b21-4099-87ee-2a40d80b9c12",
        recipient: "0x77b9023145ab40c81e3ff0011223344556677889",
        amountWei: "2410000",
        txHash: "0x77b97700aa11bb22cc33dd44ee55ff66778899aabbccddeeff0011223344553140",
        status: "signed",
        createdAt: ago(2 * 3600 * 1000),
      },
      {
        id: "demo-p4",
        sessionId: "5d3a2c10-9f44-41cc-ba45-5df565d4f500",
        recipient: "0x9eb6dd02beefcafe11223344556677889900aabb",
        amountWei: "22000",
        txHash: "0x9eb6eeff112233aabbccddeeff00112233445566778899aabbccddeeff00dd02",
        status: "signed",
        createdAt: ago(5 * 3600 * 1000),
      },
      {
        id: "demo-p5",
        sessionId: "a8f1de42-3b21-4099-87ee-2a40d80b9c12",
        recipient: "0x77b9023145ab40c81e3ff0011223344556677889",
        amountWei: "1060000",
        txHash: "0x4f1abee2233aabbccddeeff00112233445566778899aabbccddeeff00112266e98",
        status: "signed",
        createdAt: ago(9 * 3600 * 1000),
      },
      {
        id: "demo-p6",
        sessionId: "5d3a2c10-9f44-41cc-ba45-5df565d4f500",
        recipient: "0x9eb6dd02beefcafe11223344556677889900aabb",
        amountWei: "18000",
        txHash: "0x2da7ee11ff223344556677889900aabbccddeeff00112233445566778899ab01b3",
        status: "signed",
        createdAt: ago(14 * 3600 * 1000),
      },
      {
        id: "demo-p7",
        sessionId: "a8f1de42-3b21-4099-87ee-2a40d80b9c12",
        recipient: "0xb88c023145ab40c81e3ff0011223344556677fa24",
        amountWei: "3180000",
        txHash: "0xb88c0011aa22bb33cc44dd55ee66ff77889900aabbccddeeff001122334455f724",
        status: "signed",
        createdAt: ago(24 * 3600 * 1000),
      },
      {
        id: "demo-p8",
        sessionId: "5d3a2c10-9f44-41cc-ba45-5df565d4f500",
        recipient: "0x77b9023145ab40c81e3ff0011223344556677889",
        amountWei: "5920000",
        txHash: "0x05fe11aabbcc223344ee55ff66778899aabbccddeeff00112233445566778899c40",
        status: "signed",
        createdAt: ago(2 * 24 * 3600 * 1000),
      },
    ],
  };
}
