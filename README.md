# Scout Reporter

Scouting tools for **Football Manager 27 and 26**. Import a player export from FM, or scan the game
directly with the desktop app, and rank players on weighted attributes and FM27 benchmark roles.

**Website:** [fmscouting.sebastianfoder.com](https://fmscouting.sebastianfoder.com) ·
**Desktop app:** [download for Windows](https://fmscouting.sebastianfoder.com/download)

## What it does

- **Player list and profiles**: scores from your own attribute weights or the FM27 benchmark roles
  (from [jamiebolden/fm-scoring](https://github.com/jamiebolden/fm-scoring)), a vs-age column, a
  development plan per player, and a side-by-side compare
- **Wonderkid**: estimates prospects' attributes at full potential and ranks them
- **Best XI**: the best eleven for a formation, with an optional transfer budget
- **Squad**: your first and second eleven, gaps, weak spots, ageing starters and upgrades from your scouting
- **Staff** and **Best backroom**: staff scored on 17 roles, and the best combination to hire
- **Growth** (desktop): CA, PA and attribute changes between two scans of your save

The website reads CSV exports made with the views in `apps/web/public/*.fmf`; the site's
[How to use](https://fmscouting.sebastianfoder.com/how-to-use) page walks through it. Everything runs
in the browser: the CSV never leaves your machine.

## Desktop app (Windows)

The desktop app has every screen of the website, plus **Scan FM**: open a Player Search (or Staff
Search) in a running FM, press **F9**, and the players it found, with your own club, are in the app
a couple of seconds later. No view or CSV export needed, and it includes real CA, PA and hidden
attributes (one switch turns those off). It only reads FM's memory; it never changes the game or
your save.

- **Install:** download `Scout-Reporter-Setup-<version>.exe` from the
  [download page](https://fmscouting.sebastianfoder.com/download) or the
  [desktop releases](https://github.com/SebastianFoder/fm-scoutreporter/releases?q=desktop-v&expanded=true).
  It is not code-signed yet, so SmartScreen warns on first run: **More info** > **Run anyway**.
- **Supported:** FM27 (27.0) and FM26 (26.3) on Windows, from Steam, Epic or Game Pass. A big FM
  patch can move the data the reader looks for; the app warns when the game version differs. Mac is
  planned.
- Scans are stored under `%APPDATA%\Scout Reporter\scans`.

## Development

Needs [Bun](https://bun.sh); the desktop reader also needs the .NET 10 SDK.

```bash
bun install
bun dev                  # website on http://localhost:3000
bun run test             # tests in every workspace
bun run lint
bun run storybook        # components on http://localhost:6006

bun run reader:build     # the memory reader: reader/dist/ScoutReporter.Reader.exe
bun run desktop:dev      # desktop app with hot-reloading pages
bun run desktop:dist     # Windows installer in apps/desktop/release
```

| Path | What |
|------|------|
| `apps/web` | Next.js website, also the desktop app's pages (built with `SCOUTREPORTER_TARGET=desktop`) |
| `apps/desktop` | Electron app: window, scanning, scan storage (SQLite) |
| `packages/core` | Shared logic: CSV parsing, scoring, roles and potential, Best XI, squad, staff, scan format |
| `packages/ui` | Shared React components and screens, styles and Storybook |
| `reader` | C# memory reader for FM ([README](reader/README.md), [re-pinning after a patch](reader/REPIN.md), [speed](reader/PERFORMANCE.md)) |

## Releases

- **Website:** [semantic-release](https://github.com/semantic-release/semantic-release) publishes a
  release (`vX.Y.Z`, `CHANGELOG.md`) when `feat:` or `fix:` commits land on `master`, so use
  [Conventional Commits](https://www.conventionalcommits.org/).
- **Desktop:** released by hand. Run **Actions > Desktop release > Run workflow** with a version, or
  `gh workflow run desktop-release.yml -f version=0.2.0`. It tags `desktop-v0.2.0`, tests, builds
  and smoke-tests the installer and publishes it with a checksum. Pushing a `desktop-v*` tag also
  works, except on a `[skip ci]` commit.

## Credits

The reader is adapted from [FMSuperScout](https://github.com/mavarobli/FMSuperScout) by mavarobli
(MIT, see `reader/LICENSE-FMSuperScout`). FM27 weights, age benchmarks and training research come
from [jamiebolden/fm-scoring](https://github.com/jamiebolden/fm-scoring).
