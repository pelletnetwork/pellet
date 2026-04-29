"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type SearchHit = {
  kind: "event" | "agent" | "service" | "address";
  id: string;
  label: string;
  sub: string;
  href: string;
};

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  event: "EVT",
  agent: "AGT",
  service: "SVC",
  address: "ADR",
};

export function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  // ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state when closing; focus input when opening.
  useEffect(() => {
    if (open) {
      setSelectedIdx(0);
      // Defer focus until after the modal is in the DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setHits([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/oli/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { hits: SearchHit[] };
        // Drop stale responses if a newer query has been issued.
        if (seq !== requestSeq.current) return;
        setHits(data.hits);
        setSelectedIdx(0);
      } catch {
        if (seq === requestSeq.current) setHits([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query, open]);

  const navigate = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      if (hit.href.startsWith("http")) {
        window.open(hit.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(hit.href);
      }
    },
    [router],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[selectedIdx];
      if (hit) navigate(hit);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="oli-cmdk-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="oli-cmdk-modal"
            role="dialog"
            aria-label="Search"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="oli-cmdk-input-wrap">
              <span className="oli-cmdk-input-prefix" aria-hidden="true">
                ⌘
              </span>
              <input
                ref={inputRef}
                className="oli-cmdk-input"
                placeholder="Search events, agents, services, addresses…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                spellCheck={false}
                autoComplete="off"
              />
              {loading && <span className="oli-cmdk-spinner" aria-hidden="true" />}
            </div>
            <div className="oli-cmdk-results" role="listbox">
              {query.trim().length < 2 && (
                <div className="oli-cmdk-hint">
                  Type to search · ↑↓ navigate · ↵ open · esc close
                </div>
              )}
              {query.trim().length >= 2 && hits.length === 0 && !loading && (
                <div className="oli-cmdk-hint">No matches.</div>
              )}
              {hits.map((hit, i) => (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === selectedIdx}
                  data-selected={i === selectedIdx}
                  className="oli-cmdk-result"
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => navigate(hit)}
                >
                  <span className="oli-cmdk-result-kind">{KIND_LABEL[hit.kind]}</span>
                  <span className="oli-cmdk-result-label">{hit.label}</span>
                  <span className="oli-cmdk-result-sub">{hit.sub}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
