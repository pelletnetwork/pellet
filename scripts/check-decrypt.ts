// Smoke-test: decrypt the most recent wallet_sessions row's session key
// ciphertext and print its EOA address. Should match what the browser
// /approve response returned to the user.
//
// Run: npx tsx --env-file=.env.local scripts/check-decrypt.ts [label]

import { decryptSessionKey } from "@/lib/wallet/session-keys";
import { privateKeyToAddress } from "viem/accounts";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const label = process.argv[2] ?? "phase-3a-smoke";
  const rows = await db.execute<{ session_key_ciphertext: Uint8Array | null }>(sql`
    SELECT session_key_ciphertext
    FROM wallet_sessions
    WHERE label = ${label}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const r = rows.rows[0];
  if (!r || !r.session_key_ciphertext) {
    console.error(`no session_key_ciphertext for label=${label}`);
    process.exit(2);
  }
  const ct = Buffer.from(r.session_key_ciphertext);
  console.log("ciphertext bytes:", ct.length);
  const pk = decryptSessionKey(ct);
  const addr = privateKeyToAddress(pk);
  console.log("decrypted private key:", pk.slice(0, 10) + "..." + pk.slice(-4));
  console.log("agent EOA address:    ", addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
