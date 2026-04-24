"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { explorerAddressUrl, HL_EXPLORER } from "@/lib/hl/addresses";
import {
  shortAddr,
  timeAgo,
  useLiveFeed,
  type FeedItem,
} from "@/lib/hl/useLiveFeed";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const row = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] as const },
  },
};

const EXPLORER = HL_EXPLORER.mainnet;

function txUrl(txHash: string): string {
  return `${EXPLORER}/tx/${txHash}`;
}

export function LiveFeed() {
  const { items, loading } = useLiveFeed("mainnet");
  // Re-render every 10s so the "X ago" labels stay fresh without re-fetching.
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.section
      className="live-feed"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="f-header">
        <h3>Live registry events</h3>
        <span className="f-meta">
          <span className="pellet-dot pellet-dot-lg" />
          {loading && items.length === 0 ? "Connecting" : "Streaming"}
        </span>
      </div>
      {items.length === 0 && !loading && (
        <div className="feed-empty" style={{ padding: "16px 0", color: "var(--muted)", fontSize: 12 }}>
          Awaiting the next registry event.
        </div>
      )}
      {items.map((it) => (
        <FeedRow key={`${it.txHash}-${it.logIndex}`} item={it} />
      ))}
    </motion.section>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const isAttest = item.kind === "Attest";
  const blockLabel = `#${item.block.toLocaleString()}`;
  const timeLabel = timeAgo(item.timestamp);
  return (
    <motion.div className="feed-item" variants={row} whileHover="hover">
      <span className={`type${isAttest ? " attest" : ""}`}>{item.kind}</span>
      <span className="addr">
        <a
          className="addr-link"
          href={explorerAddressUrl(item.actor)}
          target="_blank"
          rel="noopener noreferrer"
          title={`View ${item.actor} on HyperScan`}
        >
          {shortAddr(item.actor)}
        </a>
        {"  →  "}
        <span style={{ color: "var(--navy)" }}>#{item.agentId.toString()}</span>
      </span>
      <motion.span
        className="arrow"
        variants={{ hover: { x: 4 } }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        →
      </motion.span>
      <a
        className="block addr-link"
        href={txUrl(item.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        title={`View tx on HyperScan`}
      >
        {blockLabel}
      </a>
      <span className="time">{timeLabel}</span>
    </motion.div>
  );
}
