import type { Metadata } from "next";
import { DeviceApproval } from "./DeviceApproval";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect agent · Pellet Wallet",
  description: "Approve an agent to spend from your Pellet Wallet on Tempo.",
};

export default async function OliDeviceApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <DeviceApproval initialCode={code ?? ""} />;
}
