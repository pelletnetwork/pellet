"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";

import { feedItemFromWire, type FeedItem, type FeedItemWire } from "./recentEvents";
import type { HlChain } from "./types";

export type { FeedKind, FeedItem } from "./recentEvents";

// The hook fetches the cached `/api/feed` Route Handler — server fetches
// the data from HyperEVM RPC once per cache window (revalidate = 30s) and
// every visitor shares the result. Client RPC pressure: zero. The seed
// pin below guarantees we always render at least one item even before the
// first fetch returns or if the API is briefly unhealthy.
const POLL_MS = 30_000;
const MAX_FEED_ITEMS = 10;
const FEED_API = "/api/feed";

function dedupeKey(it: { txHash: Hex; logIndex: number }): string {
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
    // chain is read from the API path; if we ever support testnet we'd add
    // ?chain=testnet to the URL. Today the route is mainnet-only.
    void chain;
    let alive = true;

    async function fetchFeed() {
      try {
        const res = await fetch(FEED_API, { cache: "no-store" });
        if (!res.ok) throw new Error(`/api/feed ${res.status}`);
        const json = (await res.json()) as { items: FeedItemWire[] };
        const live = (json.items ?? []).map(feedItemFromWire);

        // Merge API items with seed events (milestones older than the
        // server's lookback window). Dedupe by tx + logIndex.
        const seen = new Set<string>();
        const merged: FeedItem[] = [];
        for (const it of [...live, ...SEED_EVENTS]) {
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
        setItems(merged.slice(0, MAX_FEED_ITEMS));
        setLoading(false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[useLiveFeed] /api/feed fetch failed:", e);
        if (alive) setLoading(false);
        // keep prior state (seed events)
      }
    }

    void fetchFeed();
    const timer = setInterval(fetchFeed, POLL_MS);
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
