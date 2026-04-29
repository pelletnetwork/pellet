-- Pellet Wallet · Step 1 schema. Device-code pairing flow for the CLI.
--
-- A pairing starts on the agent side: CLI POSTs /api/wallet/device/start,
-- gets back a (code, deviceId, expiresAt). The user visits
-- /wallet/device?code=<word-pass> in a browser, authenticates, and approves
-- — at which point the pairing flips to 'approved' and the bearer token is
-- materialized. The CLI is polling /api/wallet/device/poll the whole time;
-- it picks up the bearer the moment the row flips.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "wallet_device_pairings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-readable word-passphrase the user types/verifies in the browser.
  -- Three words from a ~100-word dict = ~1M combos; short TTL bounds risk.
  "code" text NOT NULL UNIQUE,
  -- Opaque id the CLI polls with. Different from the code so the CLI can
  -- safely log it (it's not the secret); the code is what authenticates.
  "device_id" text NOT NULL UNIQUE,
  -- Pending → approved (user approved in browser) → claimed (CLI fetched
  -- the bearer). 'expired' is a terminal state the cron sweep can mark.
  "status" text NOT NULL DEFAULT 'pending',
  -- Once approved, the bearer token's SHA-256 hash. Cleartext bearer is
  -- returned to the CLI exactly once, then forgotten by the server.
  "bearer_token_hash" text,
  -- Once approved, the user_id that approved. NULL until then.
  "approved_user_id" uuid REFERENCES "wallet_users"("id") ON DELETE SET NULL,
  -- Caps chosen at approval time, mirrored onto the eventual wallet_session.
  "approved_spend_cap_wei" text,
  "approved_per_call_cap_wei" text,
  "approved_session_ttl_seconds" integer,
  -- Optional label the agent suggests at /start; user sees it in approval UI.
  "agent_label" text,
  -- TTL window for the pairing itself (5 min default). Caps unauth'd risk.
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "approved_at" timestamp with time zone,
  "claimed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "wallet_device_pairings_status_idx"
  ON "wallet_device_pairings" USING btree ("status");
CREATE INDEX IF NOT EXISTS "wallet_device_pairings_expires_idx"
  ON "wallet_device_pairings" USING btree ("expires_at")
  WHERE "status" = 'pending';
