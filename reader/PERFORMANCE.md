# Reader speed

How the reader spends its time, and how to check that a faster reader still reads the same data.

## Where the time goes

A scan has these steps. Each is timed: the times are in the reader's log (`Steps: ...`), in
diagnostics.txt, and in the `timings` object of the `done` line.

| Step | What it does |
|---|---|
| open | Lists FM's memory regions and finds its two modules, caches the module images |
| version | Reads game_plugin.dll's version, finds FM's search class |
| find | The scan pass: copies the heap in 32 MB pieces (workers share a queue) and notes every person in it (UID, address, CA/PA, contract, birth date), from the copied memory |
| merge | Joins the pieces' finds in a fixed order |
| contracts | Each player's contract club (the owner) |
| squads | Links players to the club whose squad they are in (clubs read in parallel) |
| date | The in-game date and season year |
| search | Finds the people in FM's search result |
| pick | Search scans only: picks the people to read (the search result and your club) |
| read people | Reads the picked people's fields: name, attributes, contract, club, personality |
| diagnostics | diagnostics.txt, and keeping only the search (`--only-search`) |
| write | Writes scan.ndjson |

The app adds its own part to the scan log and diagnostics.txt: `App: reader ... (start to finish),
import ...`. `node apps/desktop/scripts/time-scan.mjs` (or `bun run desktop:time-scan`) times
scans in the built app, from clicking Scan FM to the players on screen.

Copying FM's memory is cheap: about 0.5 s for 5 to 9 GB with 8 threads. A single small read costs
about 0.8 µs, because every one goes through Windows (ReadProcessMemory), and reading a person took
about 150 to 250 of them. A different language would make the same calls at the same cost: the fix
was fewer calls. Small reads now fetch the whole 4 KB page once and serve the rest from it (Windows
grants access per page, so the results are the same), and a search scan reads only the people it
keeps.

Measured on a paused FM27 27.0.1 save (396k players, 173k staff; a Player Search with 1,151
players, 1,298 people kept with your club; 8 workers):

| | Before (2026-11-13) | After (2026-11-14) |
|---|---|---|
| Search scan, reader | 15.6 s | 1.8 to 2.1 s |
| Search scan in the app, click to players on screen | about 16 s (30 s with a retry) | 2.0 s |
| Search scan with the snapshot retry | about 32 s | 4.2 s |
| Full scan, reader | 16 to 18 s | 8 to 9 s |

```
before, search: open 306 ms, version 73 ms, find 1,712 ms, merge 74 ms, read people 10,595 ms,
                squads 2,333 ms, date 99 ms, search 25 ms, diagnostics 44 ms, write 17 ms
after, search:  open 134 ms, version 69 ms, find 847 ms, merge 128 ms, contracts 172 ms, squads 196 ms,
                date 28 ms, search 3 ms, pick 81 ms, read people 16 ms, diagnostics 22 ms, write 30 ms
after, full:    open 291 ms, version 69 ms, find 977 ms, merge 126 ms, contracts 160 ms, squads 151 ms,
                date 29 ms, search 3 ms, read people 3,759 ms, diagnostics 21 ms, write 2,438 ms
```

Reading people in a full scan varies with how busy the PC is (4 to 8 s in the same session). The
first scan after a new reader was installed took 12 s once, while Windows checked the new exe; it
did not happen again.

## The retry

When more than 10 % of FM's memory cannot be read live, the reader scans again from a frozen copy
of it (a VA clone snapshot). After the speed-ups this costs little: on 2026-11-14 a search scan with
a retry took 4.2 s (taking the snapshot 0.35 s, the second scan about 2 s), and its output was
identical to a normal scan. A full scan reads people more slowly from the snapshot (12 s instead of
4 s), but full scans are rare. `--force-retry` forces the retry, to test it:

```bash
reader\dist\ScoutReporter.Reader.exe scan --out C:\tmp\retry --only-search --force-retry
bun run reader:check -- --compare C:\tmp\ref\scan.ndjson C:\tmp\retry\scan.ndjson
```

A search scan could skip the retry when nothing it keeps was lost, but that cannot be told for
sure: your club's squad lists normally hold a few entries that match no player, and staff at your
club are found only through their contracts. So the retry stays.

## Checking a change

`bun run reader:check` runs a reader against the running FM, prints the wall time and the steps,
and with `--ref` compares the scan with a reference scan, person by person and field by field.

```bash
# 1. A reference scan with the reader before the change (keep a copy of that exe):
bun run reader:check -- --exe C:\path\to\old\ScoutReporter.Reader.exe --out C:\tmp\ref

# 2. Build the changed reader and compare:
bun run reader:build
bun run reader:check -- --out C:\tmp\new --ref C:\tmp\ref\scan.ndjson

# Add --only-search to both for a search scan (FM's Player Search must be on screen).
# Compare two files you already have:
bun run reader:check -- --compare C:\tmp\ref\scan.ndjson C:\tmp\new\scan.ndjson
```

**Keep FM on one in-game day for the whole check: do not press Continue, and wait until FM has
finished processing.** Values, reputations, CA and attributes change as the game moves on, and the
comparison then shows those changes. Two scans of a game that holds still are identical: on
2026-11-13 two scans with the same reader agreed on all 568,932 people, even though one of them could
not read 4.1 % of memory. People missing from one side of a comparison come from memory that was
unreadable in that run; a field that differs for someone found in both is a real difference.
