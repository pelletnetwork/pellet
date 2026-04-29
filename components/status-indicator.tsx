import { glyphs } from "@/lib/design/glyphs";

type Props = {
  state: "live" | "idle" | "error";
  label?: string;
};

const stateMap = {
  live: { glyph: glyphs.live, color: "text-accent", animate: "animate-pulse" },
  idle: { glyph: glyphs.idle, color: "text-muted", animate: "" },
  error: { glyph: glyphs.live, color: "text-fg", animate: "animate-pulse" },
};

export function StatusIndicator({ state, label }: Props) {
  const cfg = stateMap[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`${cfg.color} ${cfg.animate}`}>{cfg.glyph}</span>
      {label && <span className="text-muted">{label}</span>}
    </span>
  );
}
