# Reader speed

How the reader spends its time, and how to check that a faster reader still reads the same data.

## Where the time goes

A scan has these steps. Each is timed: the times are in the reader's log (`Steps: ...`), in
diagnostics.txt, and in the `timings` object of the `done` line.

| Step | What it does |
|---|---|
| open | Lists FM's memory regions and modules, caches the module images |
| version | Reads game_plugin.dll's version, finds FM's search class |
| find | The scan pass: copies the heap in 32 MB blocks and notes every person in it (UID, address, CA/PA), from the copied memory |
| merge | Joins the workers' finds |
| read people | Reads each found person's fields: name, attributes, contract, club, personality |
| squads | Links players to the club whose squad they are in |
| date | The in-game date and ages |
| search | Marks the people in FM's search result |
| diagnostics | diagnostics.txt, and keeping only the search (`--only-search`) |
| write | Writes scan.ndjson |

The app adds its own part to diagnostics.txt: `App: reader ... (start to finish), import ...`.

Copying FM's memory is cheap: about 0.5 s for 5 to 9 GB with 8 threads. A single small read costs
about 0.8 µs, because every one goes through Windows (ReadProcessMemory). "read people" makes about
150 to 250 such reads per person, which is why it is the slow step on a whole database. A different
language would make the same calls at the same cost: the fix is fewer calls.

Measured on 2026-11-13 (FM27 27.0.1, 396k players and 173k staff, 8 workers):

```
open 296 ms, version 124 ms, find 1,748 ms, merge 61 ms, read people 9,775 ms,
squads 2,206 ms, date 104 ms, search 22 ms, diagnostics 22 ms, write 2,095 ms
```

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
