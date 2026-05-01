import { Keycap } from "./Keycap";
import { ThemeToggle } from "./ThemeToggle";

export type KeymapItem = {
  keys: string[];
  label: string;
  /**
   * If true, the `M` keycap is replaced with the live ThemeToggle button so
   * users can click as well as press M. Used for the Light/dark entry.
   */
  toggle?: boolean;
};

const DEFAULT_ITEMS: KeymapItem[] = [
  { keys: ["↑", "↓", "←", "→"], label: "Navigate" },
  { keys: ["1", "2", "3"], label: "To section" },
  { keys: ["W", "A", "S", "D"], label: "Scroll" },
  { keys: ["+", "−"], label: "Zoom" },
  { keys: ["R"], label: "Reset" },
  { keys: ["B", "L", "I"], label: "Weight/italic" },
  { keys: ["M"], label: "Light/dark", toggle: true },
  { keys: ["H"], label: "Hide keys" },
];

/**
 * Bottom keymap legend — fixed footer rendering pairs of `[keycap…] label`
 * separated by whitespace. Pure mono; no separators between pairs.
 *
 * Pages can override the default set by passing `items`. Default reads:
 *
 *   ↑↓←→ Navigate    1 2 3 To section    W A S D Scroll    + − Zoom    R Reset
 *   B L I Weight/italic    M Light/dark    H Hide keys
 *
 * The `M Light/dark` entry hosts a clickable <ThemeToggle /> that doubles as
 * the keycap glyph — pressing M anywhere on the page or clicking the button
 * flips the shell to dark and back.
 */
export function KeymapLegend({
  items = DEFAULT_ITEMS,
}: {
  items?: KeymapItem[];
}) {
  return (
    <footer className="oli-keymap" role="contentinfo" aria-label="Keymap legend">
      {items.map((item) => (
        <span key={item.label} className="oli-keymap-item">
          <span className="oli-keymap-keys">
            {item.toggle && item.keys.length === 1 && item.keys[0] === "M" ? (
              <ThemeToggle />
            ) : (
              item.keys.map((k, i) => (
                <Keycap key={`${item.label}-${i}-${k}`}>{k}</Keycap>
              ))
            )}
          </span>
          <span className="oli-keymap-label">{item.label}</span>
        </span>
      ))}
    </footer>
  );
}
