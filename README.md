# FM26 Scout Reporter

A modern web app for importing **Football Manager 26** player CSV exports and turning them into a searchable, comparable scouting view with configurable:

- Attribute **weights** (profiles)
- Highlighted attributes (profiles)
- Attribute value bands / thresholds (profiles)
- Light/Dark themes
- Player comparison (gold/silver/bronze per attribute, relative to selected players)

## Features

- **CSV import** (semicolon-delimited FM export) from the homepage
- **Persisted imports**: player, squad and staff imports are kept in IndexedDB (database `scoutreporter`,
  store `imports`, keyed `importedPlayersCsv`, `importedSquadCsv`, `importedStaffCsv`), so they survive
  reloads and visits like before, and full-database imports fit. Imports saved by older versions in
  localStorage (or sessionStorage) move across on first load. Open tabs stay in sync. Without IndexedDB
  the app falls back to localStorage. Settings (profiles, theme, formations) stay in localStorage
- **Player list** with score + highlighted attributes
- **Player profile** view (with goalkeeper-specific layout when position includes `GK`)
- **Compare view** with:
  - Player selector (search + pagination)
  - Comparison table
  - Per-row medal ranking (gold/silver/bronze)
- **How to use** page with step-by-step exporter setup guide
- **FM27 benchmark profiles** (CB, WB/DM, AM/Winger, Striker, GK) and a **vs Age** column, from
  [jamiebolden/fm-scoring](https://github.com/jamiebolden/fm-scoring)'s FM27 weights and age benchmarks
- **Wonderkid mode** (`/wonderkid`): with the Hidden Attributes view (`apps/web/public/SCOUT REPORTER Hidden Attributes.fmf`, adds
  the hidden Professionalism, CA and PA) it estimates each player's attributes at full potential using the FM27
  CA-cost table and harvestgreen22's FM27 training test (per-attribute growth by position), then ranks prospects
  on the benchmark roles
- **Development plan** on every player page: individual focus, training role, the development sessions and
  coaching groups that matter most for their best role, plus playing-time and personality notes, from the FM27
  training research collected in fm-scoring
- **Best XI** (`/best-xi`): picks the highest-scoring eleven for a formation from the imported players,
  with an optional minimum and maximum on the eleven's total transfer value. Each position is scored
  on a weight profile of your choice (FM27 benchmark roles by default)
- **Formations** (Best XI and Squad analysis): FM's tactics pitch, with its 24 spots (DL, DCL, DC, DCR,
  DR, WBL, DMCL … STCL, STC, STCR). Start from one of FM's preset formations, click a position and then
  an empty spot to move it, and save your own formations by name (`localStorage` key `savedFormations`,
  shared by both pages). A spot needs the matching export position: DCL, DC and DCR all need D (C)
- **Squad analysis** (`/squad`): import your own squad (Squad view `apps/web/public/SCOUT REPORTER Squad.fmf` or
  Squad Hidden Attributes view `apps/web/public/SCOUT REPORTER Squad Hidden Attributes.fmf`; plain player exports work too, stored
  separately from the player import under the import key `importedSquadCsv`), pick a formation and
  it builds the first eleven and, from everyone left, the second eleven (the cover). It flags positions
  nobody plays naturally, weak starters, missing cover, big drops to the backup, ageing starters with or
  without a young successor, and (with CA/PA) youngsters projected to overtake a starter. The rest of the
  squad is listed with their best-fit position, and players in the player import who would beat the
  weakest starter at a position are shown as upgrades. The Squad views add squad-only columns, read by
  `packages/core/squad/squad-fields.ts` (column meanings: [FM View Exporter's column reference](https://github.com/ElectroHugin/FM-View-Exporter/blob/main/docs/columns/fm27.csv)):
  Playing Time (squad status; "Out On Loan" players are left out unless you count them), Injury (optionally
  leave injured players out), Picked (your FM team sheet, compared with the suggested eleven), Ability /
  Potential (the coach's stars, used for prospects when there is no CA/PA), Happiness, Personality and Time
  Missed (shown in the tables). The Inf column's codes are undocumented, so only `Inj` is used
- **Staff mode** (`/staff`): import a staff search export made with the Staff view
  (`apps/web/public/SCOUT REPORTER Staff.fmf`). FM26 shows staff attributes as words; they are mapped back to the
  1–20 scale (Unsuited 1–3 up to Elite 20) and every staff member is scored on the 17 staff roles from
  [fm-scoring](https://github.com/jamiebolden/fm-scoring)'s `weights/fm27.toml` (nine coaching groups, manager,
  assistant, director of football, head of youth development, scout, performance analyst, physio, sports
  scientist). Rank by best role, preferred job or any role; filtering by preferred job shows only the
  attributes fm-scoring weights for that job. Filter free agents, and open a staff member for every role
  ranked. Stored separately
  from the player import (import key `importedStaffCsv`)
- **Best backroom** (`/staff/backroom`): choose how many of each staff role you need (or a preset) and it
  hires the combination with the highest total role score from the staff import, nobody used twice (the
  Best XI assignment solver with no budget). Filter to free agents or to staff whose preferred job is the
  role, and exclude anyone to see the next best pick

## Getting started

Install dependencies and run the dev server:

```bash
bun install
bun dev
```

Open `http://localhost:3000`.

### Repository layout

A Bun workspaces monorepo. The website and the desktop app share the same logic and screens:

| Path | What |
|------|------|
| `apps/web` | The Next.js website (routes, SEO, the `.fmf` views in `public/`). Deployed from this folder. |
| `apps/desktop` | The Electron desktop app (Windows): the same screens plus scanning FM's database. |
| `packages/core` (`@scoutreporter/core`) | Pure logic: CSV parsing, scoring, FM27 roles and potential, Best XI, squad and staff, plus the CSV fixtures used by tests, Storybook and "Load test data". |
| `packages/ui` (`@scoutreporter/ui`) | React components, feature screens, global styles (`styles/globals.css`) and Storybook. |
| `reader` | The C# memory reader the desktop app runs to scan FM27. |

Root scripts: `bun dev` / `bun run build` / `bun start` (website), `bun test` (every workspace),
`bun run lint`, `bun run storybook`. The shared packages have no build step: Next compiles them
(`transpilePackages`).

### SEO

Canonical URLs, the sitemap, `robots.txt`, Open Graph tags and JSON-LD use the production origin
in `apps/web/lib/site.ts` (`https://fmscouting.sebastianfoder.com`). Set `NEXT_PUBLIC_SITE_URL` to build for
another domain. Indexable routes are listed in `apps/web/lib/routes.ts`; pages that only show an imported CSV
(player list, player profile, compare) are `noindex`. The share card is generated by
`apps/web/app/opengraph-image.tsx`.

### Storybook

Browse and develop UI components in isolation:

```bash
bun run storybook        # http://localhost:6006
bun run build-storybook  # static build in storybook-static/
```

Stories live next to their components as `*.stories.tsx`. Use the toolbar's theme switch to preview light and dark mode.

Every story is wrapped in the app's providers (`packages/ui/.storybook/providers.tsx`), starting from clean storage. Control their state per story with `parameters.appProviders`:

```ts
parameters: {
  appProviders: {
    players: "fm27hidden", // pre-import a fixture: "fm26" | "fm27outfield" | "fm27hidden" (default: none)
    storage: { weights, highlights, attributeColors }, // seed the config profiles
    disable: true, // skip the providers entirely
  },
}
```

For components that take players as props, use `fixturePlayers` / `fixturePlayer` from `packages/ui/.storybook/fixtures.ts`. "Load test data" works in Storybook too, because `/api/fixtures/*` is answered from the bundled fixtures.

## Usage

- **Import CSV**: Homepage → “Choose CSV file”
- **Weights**: Homepage → “Weights” (modal)
  - Weights are **1–10 integers**
  - Profiles auto-save to `localStorage`
- **Highlights**: Homepage → “Highlights” (modal)
  - Toggle which attributes appear as highlighted columns
  - Profiles auto-save to `localStorage`
- **Attribute thresholds**: Header → “Attribute thresholds” (modal)
  - Configure numeric bands only; colours follow the light/dark theme
  - Profiles auto-save to `localStorage`
- **Compare**: Homepage → select players → “Compare selected players”

## File download (FM view)

The custom FM view is included at:

- `apps/web/public/scouting-exporter.fmf`
- `apps/web/public/SCOUT REPORTER Staff.fmf` (Staff mode)

Users can download it from the **How to use** page.

## Releases

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) to automate versioning and GitHub Releases. Releases are triggered automatically when commits land on `master`.

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format so semantic-release can determine the next version:

| Prefix | Version bump |
|--------|-------------|
| `fix:` | Patch (0.0.x) |
| `feat:` | Minor (0.x.0) |
| `feat!:` / `BREAKING CHANGE:` footer | Major (x.0.0) |

Other prefixes like `chore:`, `docs:`, `ci:` do not trigger a release.

## Tech stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

