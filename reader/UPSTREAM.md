# Upstream

The reader is adapted from [FMSuperScout](https://github.com/mavarobli/FMSuperScout) by mavarobli,
MIT licensed (see `LICENSE-FMSuperScout`).

Pinned upstream commit: `dbc8b33c84bc7bfc18a5f57483f5dc21768d2e1c` (main, 2026-11-12, FMSuperScout v1.7.3).

| Ours (`reader/src`) | Upstream | What changed |
|---|---|---|
| `Fields.cs` | `core/Fields.cs` | Translated to English. Attribute and staff keys renamed to the app's keys (`teamWork`, `workingWithYoungsters`...). Unused fields (deal table, home reputation, condition, morale) dropped. Added `Resolve(major, minor)`. |
| `MemScan.cs` | `core/MemScan.cs` | Translated. Mac-only parts (own-buffer registration, exact RTTI classes) dropped. |
| `MemScan.Win.cs` | `core/MemScan.Win.cs` | Translated. In-process (BepInEx) mode and the buffer pools dropped; clubs are always recognised by shape. |
| `Scanner.cs` | `core/Dumper.cs` | Translated and trimmed: no transfer-deal scan, no status.json, no network-save manager list, no women-database config file (a `--db` flag instead). The two squad walks are merged into one. Same scan loop, snapshot retry, club linking, in-game date and safety checks. |
| `Decode.cs` | parts of `core/Dumper.cs` | Pure helpers pulled out so they can be unit-tested; job names in English. |
| `DumpWriter.cs` | `WriteJson` in `core/Dumper.cs` | Writes our schema (`packages/core/scan/README.md`), not FMSuperScout's `dump.json`. |
| `Json.cs` | `core/Json.cs` | Translated; writes to any `TextWriter` (for tests). |
| `Program.cs` | `scanner/Program.cs` | `scan --out <dir>` and `version` only, progress as JSON lines on stdout, plus `diagnostics.txt`. No watcher and no F9 hook: the desktop app owns the hotkey. |

Added (not from upstream):

- FM's search result: `Fields.SEARCH_*`, `MemScan.VtablesOfType` (class lookup by RTTI name) and
  `Scanner.ReadSearchResults` mark the people in the result of FM's Player Search and Staff Search.
  Upstream estimates transfer interest instead; this reads the list FM itself filtered.
- `Probe.cs` and the `probe-*` commands: developer tools that find lists of players in memory.
- Club reputation is written per person (`clubReputation`).

Left out for now:

- `core/MemScan.Mac.cs` and `mac/` (loader, host module, Swift app): the Mac reader loads inside FM
  and has to start FM itself. Needed for the Mac version of the desktop app.
- `plugin/` (the old BepInEx plugin): not needed, the external reader replaces it.
- `docs/repin-guide.md`: adapted as `REPIN.md`.

To update from upstream, diff upstream `core/Fields.cs` between the pinned commit and the new one
first: offset changes after an FM patch land there.
