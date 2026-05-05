CREATE TABLE "wallet_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "wallet_users"("id") ON DELETE CASCADE,
  "plan" text NOT NULL,
  "amount_wei" text NOT NULL,
  "tx_hash" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "wallet_subscriptions_user_idx" ON "wallet_subscriptions" USING btree ("user_id", "expires_at");
