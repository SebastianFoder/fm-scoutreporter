# Scout Reporter reader

A small Windows program that reads the database of a running Football Manager 27 (or 26) from
`fm.exe`'s memory and writes it as one JSON file. The desktop app (`apps/desktop`) runs it when you
press **Scan FM** or F9. Adapted from [FMSuperScout](https://github.com/mavarobli/FMSuperScout) (MIT),
see `UPSTREAM.md`.

It only asks Windows for read access to `fm.exe` (`PROCESS_VM_READ | PROCESS_QUERY_INFORMATION`)
and never writes to the game.

## Use

```bash
ScoutReporter.Reader.exe scan --out <dir> [--db men|women|both] [--only-search] [--previous-exists]
ScoutReporter.Reader.exe version
```

`scan` writes `<dir>/scan.ndjson`, a lines file with one JSON object per line (format:
`packages/core/scan/README.md`; a full database is over 700 MB, which the desktop app imports into
SQLite line by line), and `<dir>/diagnostics.txt`,
and reports on stdout as JSON lines (`progress`, `log`, `done`, `error`). Exit codes: 0 done, 2 FM
not running, 3 a scan is already running, 4 FM runs as administrator, 5 save not loaded, 6 nothing
found, 7 too much memory unreadable, 8 no search result (with `--only-search`), 64 usage.

The scan also reads the result of FM's Player Search and Staff Search screens (every person FM
found with the filters set there, such as "Player's interest"): those people get `inSearch`, and
`meta.searchPlayers` / `meta.searchStaff` count them. See `Fields.SEARCH_*` and `REPIN.md`.

With `--only-search` (how the desktop app scans by default) only those people are written, plus
your own club: its players and staff, and its players out on loan. The scan is then an export of
the search on screen (`meta.scope` is "search", otherwise "full"). The reader still walks all of
FM's memory, so the scan takes as long; the file is a few MB, not 700. When FM has no search
result, nothing is written and the scan fails with `no-search`.

Developer commands for finding things in FM's memory (plain text output, read-only like the scan):
`probe-chain --uids a,b,c,d,...` finds a list that leads to the given players in order (for example
the rows of a search on screen), `probe-peek --addr 0x... [--rtti] [--refs]` shows what is at an
address, the class name of a vtable and what refers to it, and `probe-lists` / `probe-find` list
arrays of players and references to players. `REPIN.md` shows how they were used.

Safety rules kept from upstream: a scan that finds nobody is never written; a scan that could not
read more than 10% of memory (even after retrying from a frozen snapshot) is refused when there is
an earlier scan to keep using (an existing `scan.ndjson`, or `--previous-exists`, which the app
passes when it has stored scans); and the file is written to a temp file, then moved into place. When
`game_plugin.dll`'s version differs from the version the offsets were pinned on, the scan still
runs, but `meta.versionOk` is false and the app warns.

## Build and test

Needs the .NET 10 SDK.

```bash
bun run reader:build   # dotnet publish: reader/dist/ScoutReporter.Reader.exe (single file, self-contained)
bun run reader:test    # dotnet test reader/tests
```

The unit tests cover what does not need the game: value decoding, version resolution, the JSON
output and the write rules. Reading a live FM can only be checked by hand: start FM27, load a save,
run `scan`, and compare a few players with the game (see `REPIN.md`, step 4).

## Supported versions

| Game | Pinned on | Notes |
|---|---|---|
| FM27 | game_plugin 27.0.x | Verified upstream against FM 27.0 (02-11-2026) |
| FM26 | game_plugin 26.3.x | From tdg6661's Cheat Engine tables |

After an FM patch, see `REPIN.md`.

## Mac (later)

On macOS one process cannot read another: upstream loads a module inside FM (`mac/` and
`core/MemScan.Mac.cs`, not copied here yet), so the app has to start FM itself.
