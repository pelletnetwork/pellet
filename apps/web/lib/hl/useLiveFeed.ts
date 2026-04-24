"use client";

import { useEffect, useState } from "react";
import { parseAbiItem, type Hex } from "viem";

import { getRegistryAddresses } from "./addresses";
import { getHlClient } from "./client";
import type { HlChain } from "./types";

// HyperEVM caps eth_getLogs at 1000 blocks per call (-32602) and the public
// RPC rate-limits aggressively (-32005). For v1 we scan a single 1000-block
// window per poll on a relaxed cadence to stay well under the limit. Anything
// older than that is surfaced via SEED_EVENTS — a static list of milestone
// events that guarantees the feed is never empty even when activity is sparse
// or when the RPC throttles us. When we ship a server-side `/api/feed` route
// (v1.1) the client polling shortens to a single fetch and the seed merge
// becomes a no-op for milestones that are still within indexer history.
//
// Event payloads include `block.timestamp` (set inside the contract), so we
// render time-ago labels without an extra `eth_getBlockByNumber` call.
const POLL_MS = 30_000;
const HL_GETLOGS_CHUNK = 1000n;
const LOOKBACK_CHUNKS = 1n;
const MAX_FEED_ITEMS = 10;

const AGENT_REGISTERED = parseAbiItem(
  "event AgentRegistered(uint256 indexed agentId, address indexed controller, string metadataURI, uint256 timestamp)",
);
const ATTESTATION_POSTED = parseAbiItem(
  "event AttestationPosted(uint256 indexed attestationId, uint256 indexed agentId, address indexed attester, bytes32 attestationType, int256 score, string metadataURI, uint256 timestamp)",
);
const VALIDATION_POSTED = parseAbiItem(
  "event ValidationPosted(uint256 indexed validationId, uint256 indexed agentId, address indexed validator, bytes32 claimHash, string proofURI, uint256 timestamp)",
);

export type FeedKind = "Register" | "Attest" | "Validate";

export interface FeedItem {
  kind: FeedKind;
  /** The actor: controller (Register), attester (Attest), or validator (Validate). */
  actor: Hex;
  /** Agent ID touched by this event. */
  agentId: bigint;
  block: bigint;
  /** Unix seconds, decoded from the event itself. */
  timestamp: number;
  txHash: Hex;
  logIndex: number;
}

function dedupeKey(it: FeedItem): string {
  return `${it.txHash}-${it.logIndex}`;
}

// Milestone events to always include in the feed, regardless of how far they
// fall outside the live lookback window. Add more here as the registry grows
// and as a real indexer hasn't been wired yet.
const SEED_EVENTS: FeedItem[] = [
  {
    kind: "Register",
    actor: "0x2cbd7730994D3Ee1aAc4B1d0F409b1b62d7C1834",
    agentId: 1n,
    block: 33_329_845n,
    timestamp: 1_777_038_256,
    txHash:
      "0x4f427e4e04417f0a15072d63e89518fdc85d859d70f51ace3a4be2f332d71147",
    logIndex: 2,
  },
];

export function useLiveFeed(chain: HlChain = "mainnet"): {
  items: FeedItem[];
  loading: boolean;
} {
  // Seed the initial state so milestone events always show, even before the
  // first live poll completes (or if the live poll fails entirely).
  const [items, setItems] = useState<FeedItem[]>(() => [...SEED_EVENTS]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const client = getHlClient(chain);
    const addrs = getRegistryAddresses(chain);

    async function scanChunk(fromBlock: bigint, toBlock: bigint): Promise<FeedItem[]> {
      // Sequential — HyperEVM RPC throttles parallel getLogs hard.
      const identityLogs = await client
        .getLogs({
          address: addrs.identity,
          event: AGENT_REGISTERED,
          fromBlock,
          toBlock,
        })
        .catch((e: unknown) => {
          // eslint-disable-next-line no-console
          console.warn("[useLiveFeed] identity getLogs failed:", e);
          return [];
        });
      const reputationLogs = await client
        .getLogs({
          address: addrs.reputation,
          event: ATTESTATION_POSTED,
          fromBlock,
          toBlock,
        })
        .catch((e: unknown) => {
          // eslint-disable-next-line no-console
          console.warn("[useLiveFeed] reputation getLogs failed:", e);
          return [];
        });
      const validationLogs = await client
        .getLogs({
          address: addrs.validation,
          event: VALIDATION_POSTED,
          fromBlock,
          toBlock,
        })
        .catch((e: unknown) => {
          // eslint-disable-next-line no-console
          console.warn("[useLiveFeed] validation getLogs failed:", e);
          return [];
        });

      const out: FeedItem[] = [];
      for (const log of identityLogs) {
        if (log.args.agentId === undefined || log.args.controller === undefined) continue;
        out.push({
          kind: "Register",
          actor: log.args.controller as Hex,
          agentId: log.args.agentId,
          block: log.blockNumber!,
          timestamp: Number(log.args.timestamp ?? 0n),
          txHash: log.transactionHash!,
          logIndex: log.logIndex!,
        });
      }
      for (const log of reputationLogs) {
        if (log.args.agentId === undefined || log.args.attester === undefined) continue;
        out.push({
          kind: "Attest",
          actor: log.args.attester as Hex,
          agentId: log.args.agentId,
          block: log.blockNumber!,
          timestamp: Number(log.args.timestamp ?? 0n),
          txHash: log.transactionHash!,
          logIndex: log.logIndex!,
        });
      }
      for (const log of validationLogs) {
        if (log.args.agentId === undefined || log.args.validator === undefined) continue;
        out.push({
          kind: "Validate",
          actor: log.args.validator as Hex,
          agentId: log.args.agentId,
          block: log.blockNumber!,
          timestamp: Number(log.args.timestamp ?? 0n),
          txHash: log.transactionHash!,
          logIndex: log.logIndex!,
        });
      }
      return out;
    }

    async function poll() {
      try {
        const head = await client.getBlockNumber();
        const collected: FeedItem[] = [];
        // Walk backward in 1000-block chunks (capped at LOOKBACK_CHUNKS to
        // stay friendly with HyperEVM's public RPC rate limiter).
        for (let i = 0n; i < LOOKBACK_CHUNKS; i++) {
          const toBlock = head - i * HL_GETLOGS_CHUNK;
          const fromBlock = toBlock > HL_GETLOGS_CHUNK ? toBlock - HL_GETLOGS_CHUNK + 1n : 0n;
          if (toBlock < fromBlock) break;
          const chunk = await scanChunk(fromBlock, toBlock);
          collected.push(...chunk);
          if (collected.length >= MAX_FEED_ITEMS) break;
        }

        // Merge live results with seed events (milestones older than the
        // lookback window). Dedupe by tx + logIndex in case a seed entry
        // shows up live during the brief overlap window.
        const seen = new Set<string>();
        const merged: FeedItem[] = [];
        for (const it of [...collected, ...SEED_EVENTS]) {
          const k = dedupeKey(it);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(it);
        }
        merged.sort((a, b) => {
          if (a.block !== b.block) return Number(b.block - a.block);
          return b.logIndex - a.logIndex;
        });

        if (!alive) return;
        // eslint-disable-next-line no-console
        console.log("[useLiveFeed] poll OK:", {
          live: collected.length,
          merged: merged.length,
          head: head.toString(),
        });
        setItems(merged.slice(0, MAX_FEED_ITEMS));
        setLoading(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[useLiveFeed] poll failed:", e);
        // keep prior state (which includes seed events)
        if (alive) setLoading(false);
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [chain]);

  return { items, loading };
}

/** Format a unix-seconds timestamp into a compact "Xs / Xm / Xh / Xd ago" string. */
export function timeAgo(unixSec: number, nowMs: number = Date.now()): string {
  if (!unixSec) return "—";
  const diffSec = Math.max(0, Math.floor(nowMs / 1000 - unixSec));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/** `0xAAAAAAAA…LLLL` middle-truncate for an EVM address. */
export function shortAddr(addr: Hex): string {
  return `${addr.slice(0, 10)}…${addr.slice(-4)}`;
}
