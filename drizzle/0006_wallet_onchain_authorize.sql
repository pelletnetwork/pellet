-- Pellet Wallet · Phase 3.B foundation. Schema for on-chain authorization
-- tracking. Phase 3.B.2 will populate authorize_tx_hash + on_chain_authorized_at
-- after a successful Tempo `AccountKeychain.authorizeKey` tx.
--
-- public_key_uncompressed lives on wallet_users so we can hand viem's
-- Account.fromWebAuthnP256 a flat 0x04||x||y hex string without decoding
-- COSE on every signing call. Phase 2 stored COSE-encoded bytea; we'll
-- backfill uncompressed once the COSE→XY helper is in lib/wallet/tempo-account.ts.
--
-- Idempotent — safe to re-run.

ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "authorize_tx_hash" text;
ALTER TABLE "wallet_sessions" ADD COLUMN IF NOT EXISTS "on_chain_authorized_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "wallet_sessions_authorize_tx_idx"
  ON "wallet_sessions" USING btree ("authorize_tx_hash")
  WHERE "authorize_tx_hash" IS NOT NULL;

ALTER TABLE "wallet_users" ADD COLUMN IF NOT EXISTS "public_key_uncompressed" text;
