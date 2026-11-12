# Scout Reporter reader

A small Windows program that reads the database of a running Football Manager 27 (or 26) from
`fm.exe`'s memory and writes it as one JSON file. The desktop app (`apps/desktop`) runs it when you
press **Scan FM** or F9. Adapted from [FMSuperScout](https://github.com/mavarobli/FMSuperScout) (MIT),
see `UPSTREAM.md`.

It only asks Windows for read access to `fm.exe` (`PROCESS_VM_READ | PROCESS_QUERY_INFORMATION`)
and never writes to the game.

## Use

```bash
ScoutReporter.Reader.exe scan --out <dir> [--db men|women|both]
ScoutReporter.Reader.exe version
```

`scan` writes `<dir>/scan.json` (format: `packages/core/scan/README.md`) and `<dir>/diagnostics.txt`,
and reports on stdout as JSON lines (`progress`, `log`, `done`, `error`). Exit codes: 0 done, 2 FM
not running, 3 a scan is already running, 4 FM runs as administrator, 5 save not loaded, 6 nothing
found, 7 too much memory unreadable, 64 usage.

Safety rules kept from upstream: a scan that finds nobody is never written; a scan that could not
read more than 10% of memory (even after retrying from a frozen snapshot) never replaces an
existing `scan.json`; and the file is written to a temp file, then moved into place. When
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
