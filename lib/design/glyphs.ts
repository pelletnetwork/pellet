// Semantic glyphs used across the UI.
// Single import surface so the brand voice stays consistent.

export const glyphs = {
  live: "●",
  idle: "○",
  partial: "◐",
  agent: "▣",
  event: "⌁",
  txLink: "↳",
  up: "▲",
  down: "▼",
  loadingFilled: "▰",
  loadingEmpty: "▱",
} as const;

export const eventKindGlyph: Record<string, string> = {
  swap: "⇄",
  transfer: "→",
  mint: "+",
  program_call: "⌁",
  social: "✎",
  attest: "✓",
  custom: "·",
};
