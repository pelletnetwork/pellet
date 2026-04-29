// Phase 3.B foundation smoke test: derive a real Tempo address from the
// COSE-encoded passkey public key we stored at WebAuthn enrollment time,
// and compare against the Phase 2 placeholder we recorded as
// managed_address. Replaces the placeholder once 3.B.2 ships.
//
// Run: npx tsx --env-file=.env.local scripts/check-tempo-address.ts

import { db } from "@/lib/db/client";
import { walletUsers } from "@/lib/db/schema";
import { tempoAddressFromCose, coseToUncompressed } from "@/lib/wallet/tempo-account";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute<{
    id: string;
    managed_address: string;
    keylen: number;
    passkey_public_key: Uint8Array;
  }>(sql`
    SELECT id, managed_address,
           octet_length(passkey_public_key) AS keylen,
           passkey_public_key
    FROM wallet_users
    ORDER BY created_at DESC
    LIMIT 5
  `);
  if (rows.rows.length === 0) {
    console.log("no users in wallet_users");
    process.exit(0);
  }
  for (const row of rows.rows) {
    console.log(`\nuser ${row.id.slice(0, 8)}…`);
    console.log("  COSE bytes:        ", row.keylen);
    console.log("  placeholder addr:  ", row.managed_address);
    if (!row.passkey_public_key || row.keylen === 0) {
      console.log("  (no public key — pre-Phase-2 placeholder row, skip)");
      continue;
    }
    try {
      const cose = Buffer.from(row.passkey_public_key);
      const uncompressed = coseToUncompressed(cose);
      const real = tempoAddressFromCose(cose);
      console.log("  uncompressed (XY):  0x04…", uncompressed.slice(-12));
      console.log("  real Tempo addr:   ", real);
      console.log("  matches placeholder?", real === row.managed_address ? "✓" : "✗ (expected — placeholder is sha256-derived)");
    } catch (e) {
      console.error("  derivation failed: ", e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
