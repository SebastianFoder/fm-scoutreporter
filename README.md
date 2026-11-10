# FM26 Scout Reporter

A modern web app for importing **Football Manager 26** player CSV exports and turning them into a searchable, comparable scouting view with configurable:

- Attribute **weights** (profiles)
- Highlighted attributes (profiles)
- Attribute value bands / thresholds (profiles)
- Light/Dark themes
- Player comparison (gold/silver/bronze per attribute, relative to selected players)

## Features

- **CSV import** (semicolon-delimited FM export) from the homepage
- **Persisted import** (stored in `sessionStorage`, survives navigation)
- **Player list** with score + highlighted attributes
- **Player profile** view (with goalkeeper-specific layout when position includes `GK`)
- **Compare view** with:
  - Player selector (search + pagination)
  - Comparison table
  - Per-row medal ranking (gold/silver/bronze)
- **How to use** page with step-by-step exporter setup guide
- **FM27 benchmark profiles** (CB, WB/DM, AM/Winger, Striker, GK) and a **vs Age** column, from
  [jamiebolden/fm-scoring](https://github.com/jamiebolden/fm-scoring)'s FM27 weights and age benchmarks
- **Wonderkid mode** (`/wonderkid`): with the v2 view (`public/SCOUT REPORTER Attributes v2.fmf`, adds
  Professionalism, CA and PA) it estimates each player's attributes at full potential using the FM27
  CA-cost table, then ranks prospects on the benchmark roles

## Getting started

Install dependencies and run the dev server:

```bash
bun install
bun dev
```

Open `http://localhost:3000`.

### Storybook

Browse and develop UI components in isolation:

```bash
bun run storybook        # http://localhost:6006
bun run build-storybook  # static build in storybook-static/
```

Stories live next to their components as `*.stories.tsx`. Use the toolbar's theme switch to preview light and dark mode.

Every story is wrapped in the app's providers (`.storybook/providers.tsx`), starting from clean storage. Control their state per story with `parameters.appProviders`:

```ts
parameters: {
  appProviders: {
    players: "fm27v2", // pre-import a fixture: "fm26" | "fm27outfield" | "fm27v2" (default: none)
    storage: { weights, highlights, attributeColors }, // seed the config profiles
    disable: true, // skip the providers entirely
  },
}
```

For components that take players as props, use `fixturePlayers` / `fixturePlayer` from `.storybook/fixtures.ts`. "Load test data" works in Storybook too, because `/api/fixtures/*` is answered from the bundled fixtures.

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

- `public/scouting-exporter.fmf`

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

