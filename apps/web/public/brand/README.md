# Pellet Brand — Assets

Brand mark delivered 2026-04-22 by Logo Branda. Full copyright + exclusive usage rights transferred to Pellet — see `copyright-transfer.pdf`.

## Files

| File | Purpose |
|---|---|
| `pellet-mark.svg` | Primary mark — Pellet YInMn blue `#2E5090` on paper |
| `pellet-mark-white.svg` | Inverted mark — white on navy (for dark backgrounds) |
| `pellet-mark.png` | Raster reference — navy, transparent bg |
| `copyright-transfer.pdf` | Ownership transfer agreement |

The site renders the mark via the inline `<PelletMark />` component at `apps/web/app/(components)/PelletMark.tsx`. These static files are for export, print, and external use.

## Color system

| Role | Hex | Use |
|---|---|---|
| Primary | `#2E5090` | Pellet YInMn blue — mark, primary text, accents, buttons |
| Active link | `#3C62A5` | Hover/active states |
| Mist | `#6F86B8` | Secondary labels, contour marks |
| Deep | `#0F244A` | Water + night metadata shots |
| Paper | `#FFFFFF` | App background |
| Ink | `#000000` | Primary text on paper |

Live tokens are defined in `apps/web/app/globals.css` — treat that as the canonical source of truth.

## Typography

- **Courier Prime** — body, dominant editorial face
- **IBM Plex Mono** — numeric labels, hex strings, protocol metadata
- **Inter** — sparingly, for sans-serif surfaces

## Scope

Applies to all Pellet HL surfaces — `apps/web` (pellet.network), launch artifacts, docs, and design output.
