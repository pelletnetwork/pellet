import { MPP_SERVICES } from "@/data/mpp-services";
import { db } from "@/lib/db/client";
import { agents, addressLabels } from "@/lib/db/schema";

// Probe an MPP endpoint and extract the settlement address from the 402 response.
// MPP responses include a WWW-Authenticate: Payment header with structured
// data. The exact format is per the MPP spec; v0 implementation sniffs for any
// 0x-prefixed 40-hex string in the header value as a best-effort probe.
async function probeSettlementAddress(endpoint: string): Promise<string | null> {
  try {
    // Hit the root or a known path with no auth — expect 402.
    const res = await fetch(endpoint, { method: "GET" });
    const auth = res.headers.get("www-authenticate") ?? "";
    const match = auth.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

async function main() {
  let probed = 0;
  let known = 0;
  let skipped = 0;

  for (const svc of MPP_SERVICES) {
    let address = svc.settlementAddress;
    if (!address) {
      address = await probeSettlementAddress(svc.mppEndpoint);
      if (address) probed += 1;
    } else {
      known += 1;
    }

    if (!address) {
      console.warn(`✗ ${svc.id} — no settlement address found (probe failed; manually populate data/mpp-services.ts)`);
      skipped += 1;
      continue;
    }

    // Write to agents (so matcher catches Transfers involving this address).
    await db
      .insert(agents)
      .values({
        id: svc.id,
        label: svc.label,
        source: "curated",
        wallets: [address],
        bio: svc.bio,
        links: { ...svc.links, mpp: svc.mppEndpoint, category: svc.category },
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          label: svc.label,
          wallets: [address],
          bio: svc.bio,
          links: { ...svc.links, mpp: svc.mppEndpoint, category: svc.category },
        },
      });

    // Write to address_labels (so OLI decode layer can name this address).
    await db
      .insert(addressLabels)
      .values({
        address: address.toLowerCase(),
        label: svc.label,
        category: "mpp_service",
        source: "pellet_curated",
        notes: {
          service_id: svc.id,
          mpp_endpoint: svc.mppEndpoint,
          mpp_category: svc.category,
          probed_at: new Date().toISOString(),
        },
      })
      .onConflictDoUpdate({
        target: addressLabels.address,
        set: {
          label: svc.label,
          category: "mpp_service",
          source: "pellet_curated",
          notes: {
            service_id: svc.id,
            mpp_endpoint: svc.mppEndpoint,
            mpp_category: svc.category,
            probed_at: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
      });

    console.log(`✓ ${svc.id} → ${address}`);
  }

  console.log(`\nseeded: ${MPP_SERVICES.length - skipped} of ${MPP_SERVICES.length}`);
  console.log(`  ${probed} via probe, ${known} pre-known, ${skipped} skipped`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
