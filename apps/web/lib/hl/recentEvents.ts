// Server-friendly scan of recent registry events. Used by the
// `/api/feed` Route Handler to fetch + cache events server-side, so
// individual visitors don't pound HyperEVM's public RPC and trip the
// rate limiter.
//
// Bigints are stringified for the wire — JSON.stringify would otherwise
// throw on bigint values. The client de-serializes via FeedItemFromWire.

import { parseAbiItem, type Hex } from "viem";

import { getRegistryAddresses } from "./addresses";
import { getHlClient } from "./client";
import type { HlChain } from "./types";

export type FeedKind = "Register" | "Attest" | "Validate";

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

/** Wire shape — bigints stringified so JSON.stringify works. */
export interface FeedItemWire {
  kind: FeedKind;
  actor: Hex;
  agentId: string; // bigint as decimal string
  block: string; // bigint as decimal string
  timestamp: number; // unix seconds, fits in number
  txHash: Hex;
  logIndex: number;
}

/** Decoded shape used in components — bigints reconstituted. */
export interface FeedItem {
  kind: FeedKind;
  actor: Hex;
  agentId: bigint;
  block: bigint;
  timestamp: number;
  txHash: Hex;
  logIndex: number;
}

export function feedItemFromWire(w: FeedItemWire): FeedItem {
  return {
    kind: w.kind,
    actor: w.actor,
    agentId: BigInt(w.agentId),
    block: BigInt(w.block),
    timestamp: w.timestamp,
    txHash: w.txHash,
    logIndex: w.logIndex,
  };
}

function feedItemToWire(it: FeedItem): FeedItemWire {
  return {
    kind: it.kind,
    actor: it.actor,
    agentId: it.agentId.toString(),
    block: it.block.toString(),
    timestamp: it.timestamp,
    txHash: it.txHash,
    logIndex: it.logIndex,
  };
}

function dedupeKey(it: { txHash: Hex; logIndex: number }): string {
  return `${it.txHash}-${it.logIndex}`;
}

/**
 * Milestone events that should always be present in the feed regardless of
 * how far they fall outside the live lookback window OR whether the live
 * scan succeeded (HyperEVM public RPC throttles aggressively). Add new
 * entries here as the registry grows; remove only when a real indexer
 * surfaces them through the live scan window.
 */
export const SEED_EVENTS_WIRE: FeedItemWire[] = [
  {
    kind: "Register",
    actor: "0x2cbd7730994D3Ee1aAc4B1d0F409b1b62d7C1834",
    agentId: "1",
    block: "33329845",
    timestamp: 1_777_038_256,
    txHash:
      "0x4f427e4e04417f0a15072d63e89518fdc85d859d70f51ace3a4be2f332d71147",
    logIndex: 2,
  },
];

/**
 * Scan the most recent LOOKBACK_CHUNKS × HL_GETLOGS_CHUNK blocks for events
 * across all three registries. Calls run sequentially (HyperEVM throttles
 * parallel `eth_getLogs`). Returns wire-format items sorted newest first.
 */
export async function getRecentRegistryEvents(
  chain: HlChain = "mainnet",
): Promise<FeedItemWire[]> {
  const client = getHlClient(chain);
  const addrs = getRegistryAddresses(chain);

  const head = await client.getBlockNumber();
  const collected: FeedItem[] = [];

  for (let i = 0n; i < LOOKBACK_CHUNKS; i++) {
    const toBlock = head - i * HL_GETLOGS_CHUNK;
    const fromBlock =
      toBlock > HL_GETLOGS_CHUNK ? toBlock - HL_GETLOGS_CHUNK + 1n : 0n;
    if (toBlock < fromBlock) break;

    const identityLogs = await client
      .getLogs({
        address: addrs.identity,
        event: AGENT_REGISTERED,
        fromBlock,
        toBlock,
      })
      .catch(() => []);
    const reputationLogs = await client
      .getLogs({
        address: addrs.reputation,
        event: ATTESTATION_POSTED,
        fromBlock,
        toBlock,
      })
      .catch(() => []);
    const validationLogs = await client
      .getLogs({
        address: addrs.validation,
        event: VALIDATION_POSTED,
        fromBlock,
        toBlock,
      })
      .catch(() => []);

    for (const log of identityLogs) {
      if (log.args.agentId === undefined || log.args.controller === undefined) continue;
      collected.push({
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
      collected.push({
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
      collected.push({
        kind: "Validate",
        actor: log.args.validator as Hex,
        agentId: log.args.agentId,
        block: log.blockNumber!,
        timestamp: Number(log.args.timestamp ?? 0n),
        txHash: log.transactionHash!,
        logIndex: log.logIndex!,
      });
    }

    if (collected.length >= MAX_FEED_ITEMS) break;
  }

  // Convert live scan results to wire format so we can merge with the seed
  // events (which are already wire-format). Dedupe + sort newest first.
  const liveWire = collected.map(feedItemToWire);
  const seen = new Set<string>();
  const merged: FeedItemWire[] = [];
  for (const it of [...liveWire, ...SEED_EVENTS_WIRE]) {
    const k = dedupeKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(it);
  }
  merged.sort((a, b) => {
    const aBlock = BigInt(a.block);
    const bBlock = BigInt(b.block);
    if (aBlock !== bBlock) return Number(bBlock - aBlock);
    return b.logIndex - a.logIndex;
  });

  return merged.slice(0, MAX_FEED_ITEMS);
}
