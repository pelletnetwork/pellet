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

export function Sidebar() {
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
        padding: collapsed ? "12px 8px" : "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
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
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-end",
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="oli-sidebar-toggle"
        >
          <ToggleGlyph collapsed={collapsed} />
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

// Hand-tuned panel-toggle glyph. Lucide's PanelLeftClose/Open at small sizes
// renders with round line caps/joins that read as brightness blobs at line
// endpoints — on a strokeWidth-1.5 icon at 16px the divider line ends up
// looking thicker on top/bottom than mid-line. This SVG uses square caps +
// miter joins and explicit endpoint geometry, so the divider is uniform.
function ToggleGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="square"
      strokeLinejoin="miter"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* outer panel */}
      <rect x="2.5" y="3.5" width="11" height="9" />
      {/* divider — sits one cell in from the left edge */}
      <line x1="6.5" y1="3.5" x2="6.5" y2="12.5" />
      {/* directional chevron inside the right panel */}
      {collapsed ? (
        <polyline points="9.5,6 11.5,8 9.5,10" />
      ) : (
        <polyline points="11.5,6 9.5,8 11.5,10" />
      )}
    </svg>
  );
}
