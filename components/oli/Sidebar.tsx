"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Bot,
  Route,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: LucideIcon };
type Section = { label: string; items: NavItem[] };

const sections: Section[] = [
  {
    label: "Explore",
    items: [
      { label: "Dashboard", href: "/oli", icon: LayoutDashboard },
      { label: "Services", href: "/oli/services", icon: Server },
      { label: "Agents", href: "/oli/agents", icon: Bot },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Rails", href: "/oli/rails", icon: Route },
      { label: "Skills", href: "/oli/skills", icon: BookOpen },
      { label: "Methodology", href: "/oli/methodology", icon: FileText },
    ],
  },
];

const STORAGE_KEY = "pellet-oli-sidebar-collapsed";

type SidebarProps = {
  /** ISO timestamp of the most-recently-advanced ingestion cursor, or null. */
  lastSyncAtIso: string | null;
  /** Highest block number any cursor has reached, or null if no ingest yet. */
  lastBlock: number | null;
};

export function Sidebar({ lastSyncAtIso, lastBlock }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted preference on mount. SSR renders expanded by default; the
  // mount-time read snaps to the user's last choice without a flash because
  // we only paint the collapsed state once `hydrated` is true.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* localStorage unavailable; stay expanded */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const width = collapsed ? 56 : 240;

  return (
    <aside
      style={{
        width,
        borderRight: "1px solid var(--color-border-subtle)",
        height: "calc(100vh - 48px)",
        position: "sticky",
        top: 48,
        background: "var(--color-bg-base)",
        padding: collapsed ? "20px 8px" : "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        // No transition until after hydration so the collapsed snapshot from
        // localStorage doesn't animate in on every fresh page load.
        transition: hydrated ? "width var(--duration-normal) ease, padding var(--duration-normal) ease" : "none",
      }}
      className={`oli-sidebar ${collapsed ? "oli-sidebar-collapsed" : ""}`}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          minHeight: 24,
        }}
      >
        {!collapsed && (
          <SyncPill lastSyncAtIso={lastSyncAtIso} lastBlock={lastBlock} />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="oli-sidebar-toggle"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {sections.map((section) => (
        <nav key={section.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {!collapsed && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-text-quaternary)",
                padding: "0 8px",
                marginBottom: 6,
              }}
            >
              {section.label}
            </span>
          )}
          {section.items.map((item) => {
            const active =
              item.href === "/oli" ? pathname === "/oli" : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`oli-nav-link${active ? " oli-nav-link-active" : ""}`}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
              >
                <span className="oli-nav-link-icon" aria-hidden>
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {!collapsed && <span className="oli-nav-link-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}

function SyncPill({ lastSyncAtIso, lastBlock }: SidebarProps) {
  // Re-render every 30s so the "Xm ago" stays honest while the user lingers.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!lastSyncAtIso) {
    return (
      <span className="oli-sync-pill" data-tier="unknown" title="No ingest run recorded yet">
        <span className="oli-sync-pill-dot" />
        <span>not synced</span>
      </span>
    );
  }

  const ageMs = Date.now() - new Date(lastSyncAtIso).getTime();
  const tier = ageMs < 30 * 60_000 ? "fresh" : ageMs < 6 * 60 * 60_000 ? "stale" : "old";
  const agoLabel = formatAgo(ageMs);
  const blockLabel = lastBlock != null ? formatBlock(lastBlock) : "—";

  return (
    <span
      className="oli-sync-pill"
      data-tier={tier}
      title={`Last cursor advance: ${new Date(lastSyncAtIso).toLocaleString()} · block ${lastBlock?.toLocaleString() ?? "—"}`}
    >
      <span className="oli-sync-pill-dot" />
      <span className="oli-sync-pill-text">
        synced {agoLabel} · block {blockLabel}
      </span>
    </span>
  );
}

function formatAgo(ms: number): string {
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBlock(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}
