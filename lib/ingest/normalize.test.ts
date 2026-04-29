import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";
import type { HeliusEnhancedTx } from "../helius/types";

const swapTx: HeliusEnhancedTx = {
  signature: "5kF2aBcDef1234567890abcdEf1234567890aB91",
  timestamp: 1714435200,
  type: "SWAP",
  source: "JUPITER",
  feePayer: "AGENT_WALLET_AIXBT",
  description: "AGENT_WALLET_AIXBT swapped 3.2 SOL for 12400 WIF",
  tokenTransfers: [
    {
      fromUserAccount: "AGENT_WALLET_AIXBT",
      toUserAccount: "JUP",
      tokenAmount: 3.2,
      mint: "So11111111111111111111111111111111111111112",
    },
    {
      fromUserAccount: "JUP",
      toUserAccount: "AGENT_WALLET_AIXBT",
      tokenAmount: 12400,
      mint: "WIFmint11111111111111111111111111111111111111",
    },
  ],
};

describe("normalize", () => {
  it("maps a Helius SWAP into a feed event for the matched agent", () => {
    const event = normalize(swapTx, {
      id: "aixbt",
      label: "aixbt",
      wallets: ["AGENT_WALLET_AIXBT"],
    });
    expect(event).toEqual({
      agent_id: "aixbt",
      ts: new Date(1714435200 * 1000),
      kind: "swap",
      summary: "aixbt swapped 3.2 SOL for 12400 WIF",
      targets: { source: "JUPITER" },
      tx_sig: "5kF2aBcDef1234567890abcdEf1234567890aB91",
      raw: swapTx,
    });
  });

  it("returns null when no agent wallet matches the fee payer or transfers", () => {
    const event = normalize(swapTx, {
      id: "other",
      label: "other",
      wallets: ["UNRELATED_WALLET"],
    });
    expect(event).toBeNull();
  });

  it("falls back to a generic summary when no description is provided", () => {
    const tx: HeliusEnhancedTx = { ...swapTx, description: undefined };
    const event = normalize(tx, {
      id: "aixbt",
      label: "aixbt",
      wallets: ["AGENT_WALLET_AIXBT"],
    });
    expect(event?.summary).toBe("aixbt did SWAP via JUPITER");
  });

  it("matches an agent via tokenTransfer counterparty even when not the fee payer", () => {
    const tx: HeliusEnhancedTx = { ...swapTx, feePayer: "PROGRAM_RELAYER" };
    const event = normalize(tx, {
      id: "aixbt",
      label: "aixbt",
      wallets: ["AGENT_WALLET_AIXBT"],
    });
    expect(event).not.toBeNull();
    expect(event?.agent_id).toBe("aixbt");
  });

  it("maps unknown event types to the 'custom' kind", () => {
    const tx: HeliusEnhancedTx = { ...swapTx, type: "WEIRD_NEW_THING" };
    const event = normalize(tx, {
      id: "aixbt",
      label: "aixbt",
      wallets: ["AGENT_WALLET_AIXBT"],
    });
    expect(event?.kind).toBe("custom");
  });
});
