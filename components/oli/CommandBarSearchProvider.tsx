"use client";

import { SearchProvider, type SharedProps } from "fumadocs-ui/contexts/search";
import { CommandBar } from "./CommandBar";

// Adapter so fumadocs's SearchProvider can use our CommandBar as the dialog.
// SharedProps gives us controlled `open` + `onOpenChange` straight through.
function CommandBarDialog({ open, onOpenChange }: SharedProps) {
  return <CommandBar open={open} onOpenChange={onOpenChange} />;
}

/**
 * Wraps OLI routes with a SearchProvider that owns ⌘K and the visible
 * fumadocs search trigger, both routing into our existing CommandBar
 * (txs / agents / services / addresses search). Replaces the doubled-up
 * behavior we had — fumadocs default search + CommandBar each fighting
 * over ⌘K.
 */
export function OliSearchProvider({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider SearchDialog={CommandBarDialog}>{children}</SearchProvider>
  );
}
