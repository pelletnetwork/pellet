import type { ReactNode } from "react";

/**
 * Inline keycap glyph — renders a 1px-bordered square with a single mono
 * character (or short label). Matches the Commit Mono specimen's `[B]` style.
 *
 *   <Keycap>B</Keycap>   →  small bordered box w/ "B"
 *   <Keycap>↑</Keycap>   →  arrow keys
 *   <Keycap>R</Keycap>
 *
 * Inline-flex, ~18px square, 1px border in body color, no fill, square corners.
 * Sits inline in body copy without breaking line-height.
 */
export function Keycap({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className="oli-keycap" title={title} aria-label={title}>
      {children}
    </span>
  );
}
