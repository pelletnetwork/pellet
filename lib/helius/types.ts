// Subset of the Helius Enhanced Webhook payload we actually consume.
// Reference: https://docs.helius.dev/api-reference/webhooks
export type HeliusEnhancedTx = {
  signature: string;
  timestamp: number; // unix seconds
  type: string; // e.g. "SWAP", "TRANSFER", "UNKNOWN"
  source?: string; // e.g. "JUPITER", "SYSTEM_PROGRAM"
  description?: string;
  feePayer: string;
  accountData?: Array<{ account: string; nativeBalanceChange: number }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number; // lamports
  }>;
};
