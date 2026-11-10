---
name: design-standard
description: Design system for FM26 Scout Reporter. Use when creating or styling UI components, adding new pages/views, updating layouts, or when the user asks about design tokens, colors, typography, spacing, or visual styling.
---

# Scout Reporter Design Standard

Scout Reporter is a working tool for Football Manager players. They already spend hours in FM's
profile and list screens, and use Genie Scout, FBref and Transfermarkt alongside it. The UI
should feel like it belongs among those tools: **quiet chrome, dense well-made tables, and
colour spent on data**, not on decoration or "branding".

Its identity comes from things that only make sense in this product:

- **Attribute cells**: FM-style banded value cells (a one-hue ordinal ramp, number always printed).
- **Position map**: a mini pitch with the player's positions marked (`components/PositionMap.tsx`).
- **Role chart**: FM27 role scores as bars on a 0–20 axis with age-benchmark and prime markers.
- **Medals** in Compare: gold/silver/bronze chips per row.
- **Pitch mark** (`BrandMark`, `app/icon.svg`) and the dark app bar.

## Tech

- Tailwind CSS v4, configured in `app/globals.css` (no `tailwind.config.*`).
- OKLCH triplets as CSS custom properties, set at runtime by `lib/themes.ts` (light/dark).
- Semantic colours are mapped in `@theme inline`, so write `bg-surface text-muted`, never `bg-[oklch(var(--surface))]`.
- One typeface family: **Sofia Sans** (UI, `font-sans`) and **Sofia Sans Semi Condensed** (`.section-title`, table headers). Tabular figures and no ligatures globally; FM position strings like `AM (R)` must never become `AM ®`.

## Colour utilities

| Utility | Use |
|---|---|
| `paper` | Page background, table header background, subtle fills |
| `surface` | Panels, inputs, table bodies |
| `ink` / `muted` | Primary / secondary text |
| `line` | Borders and row rules |
| `accent` / `on-accent` | The one primary action per screen, links, the selected tab |
| `positive` | Values at or above benchmark (vs Age ≥ 100%, vs Prime ≥ 100%, potential gains) |
| `chrome` / `on-chrome` | App bar only |
| `series-1` | First data series (role bars), focus ring, row hover/selection tint |
| `red`, `gold`, `silver`, `bronze` (+ `on-*`) | Danger; medals |

Attribute bands are `.attr[data-band="excellent|good|average|low"]`. Their fill and ink are
per-theme tokens (`--attr-*`, `--attr-*-ink`). The ramp was contrast-checked: every text/fill
pair passes WCAG AA, and the fills step monotonically away from the surface. Users only edit
thresholds.

## Component classes (`app/globals.css`)

| Class | What it is |
|---|---|
| `.panel` | Surface, 1px line border, 6px radius. No shadow. |
| `.section-title` | Semi-condensed 650 heading inside panels and pages. Sentence case. |
| `.data-table` | Paper header row, 1px row rules, `th[aria-sort]` gets a series-1 underline, `tr[data-selected="true"]` gets a tint. |
| `.attr` | Banded attribute value cell. |
| `.field` | Input/select/textarea. Selects draw their own chevron; set left padding only. |
| `.btn` | Button base. Use `Button`, or `LINK_BUTTON_CLASS` / `LINK_BUTTON_OUTLINE_CLASS` on `<a>`/`<label>`. |
| `.link` | Accent link, underline on hover. |
| `.codeblock` | Monospace block for paths, formulas and commands. |

Shared components: `PageHeader` (title + one-line description + optional actions), `SiteHeader`,
`BrandMark`, `PositionMap`, `Modal` (`placement="side"` docks a panel to the right so the table
stays visible while editing weights or columns).

## Rules

- **Pages lead with the work.** Title row, then import/filters, then the table. No hero sections.
- **Type scale is small and steady:** page title 1.6rem bold, section titles ~0.95rem semibold, body 15px, tables 14px, meta 12–13px.
- **Sentence case** for headings, labels and buttons. No tiny tracked uppercase labels.
- **Numbers** only where there is a real sequence (setup steps). Not as decoration.
- **Charts** follow the dataviz rules: bars start at 0, one hue per series, a legend whenever marks need explaining, values printed so colour is never the only cue.
- **Settings** that need lots of controls go in the side panel, not a centred multi-column dialog.
- **Empty states:** dashed `border-line` box with centred muted text.
- **Notices:** small icon + text on a light tint (`bg-red/8`, `bg-gold/12`). No coloured side stripes.

## Anti-patterns

- Hero sections, oversized display type, "big number + small label" metric tiles
- Tiny uppercase tracked kicker labels above headings; numbered section labels with no sequence
- Gradients, glows, decorative textures or grid backgrounds, glassmorphism
- Card grids, nested cards, coloured left borders on cards
- Neo-brutalist offset shadows; hairline border plus big soft shadow
- Default AI faces (Inter, Geist, JetBrains Mono) or mono fonts used as decoration
- Raw `oklch(var(--…))` in class names when a semantic utility exists
