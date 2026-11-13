# Scan format (`scoutreporter-scan`, version 2)

How a scan travels: the reader (`reader/`, `ScoutReporter.Reader.exe scan`) writes a **lines file**
(`scan.ndjson`), the desktop app imports it into a **scan database** (`scan.sqlite`, see
[Scan database](#scan-database)) and keeps that. By default a scan holds only the people in FM's
search result plus your own club (`meta.scope` "search", a few MB). A whole-save scan (`meta.scope`
"full") is about 400,000 players and 135,000 staff in FM27: over 700 MB as JSON, more than one
JavaScript string can hold, and far too much for the window. So the file is read line by line, and
the screens query the part they need.

TypeScript types: `schema.ts`. Conversion to the app's import records: `convert.ts`. Growth between
two scans: `growth.ts` (in memory) and `db/growth.ts` (in SQL). Example: `../fixtures/scan-sample.json`
(the same records as one JSON document, built from the CSV fixtures by
`../fixtures/make-scan-sample.ts`; `db/write.ts` turns either form into a database).

Conventions: money in GBP (FM's internal currency) as whole numbers, dates as `yyyy-mm-dd`,
attributes and personality as 1..20. Unknown values are `null`.

## Lines file

One JSON object per line, UTF-8. Line 1 is the header; every further line is one person, with
`"kind": "player"` or `"kind": "staff"` and the fields below.

```jsonc
{"schema":"scoutreporter-scan","schemaVersion":2,"meta":{...}}
{"kind":"player","uid":2002083882,"name":"Alex Williamson",...}
{"kind":"staff","uid":7,"name":"Coach",...}
```

The records, shown as the whole-file JSON form (`scan-sample.json`):

```jsonc
{
  "schema": "scoutreporter-scan",
  "schemaVersion": 2,
  "meta": {
    "scannedAt": "2026-11-12T18:00:00Z",   // UTC
    "readerVersion": "0.1.0",
    "game": "FM27",                         // memory layout used
    "gameVersion": "27.0.1.0",              // game_plugin.dll file version
    "supportedVersion": "27.0",             // version the offsets were pinned on
    "versionOk": true,                      // false: the game version differs, data may be wrong
    "gameDate": "2027-08-14",               // the manager's next match date, or null
    "gameDateSource": "schedule",           // or "none"
    "gameYear": 2027,
    "manager": "Name",
    "myClub": "Club",
    "database": "men",                      // "men" | "women" | "both"
    "currency": "GBP",
    "unreadFraction": 0.0,                  // share of FM's memory that could not be read
    "searchPlayers": 164658,                // players in FM's Player Search result at scan time (0: none)
    "searchStaff": 0,                       // the same for FM's Staff Search
    "scope": "search"                       // "search": only that search and your club were kept; "full": everyone
  },
  "players": [{
    "uid": 2002083882,
    "name": "Alex Williamson",
    "birthDate": "2007-02-01",
    "age": 20,
    "nationality": "United States",         // in the game's language
    "nationId": 123,                        // optional, language independent
    "female": true,                         // only when true
    "inSearch": true,                       // only when true: in FM's search result (see below)
    "club": "Club where he plays",
    "ownerClub": "Parent club",             // only for loans
    "division": "Competition",
    "clubReputation": 6826,                 // the club's reputation, about 0..10000 (optional)
    "teamType": 0,                          // 0 first team, ~3 reserves, 10+ youth
    "ca": 112, "pa": 150,
    "wage": 1900,                           // GBP per week
    "contractExpires": "2030-06-30",
    "personality": { "ambition": 12, "loyalty": 10, "professionalism": 15, "adaptability": 11,
                     "pressure": 13, "sportsmanship": 12, "temperament": 14, "controversy": 5 },
    "reputation": { "current": 2000, "world": 1500 },
    "positions": { "GK": 20 },              // FM position ratings 1..20 (15+ = accomplished)
    "foot": { "left": 8, "right": 20 },
    "height": 184,
    "value": 950000,                        // FM's transfer value
    "askingPrice": null,
    "transferStatus": { "listed": false, "loanListed": false, "notForSale": false, "setForRelease": false },
    "attributes": { "pace": 15, "teamWork": 11, "...": 0 },   // every visible attribute, app keys
    "hidden": { "consistency": 13, "dirtiness": 6, "importantMatches": 13, "injuryProneness": 7, "versatility": 10 }
  }],
  "staff": [{
    // uid, name, birthDate, age, nationality, club, division, ca, pa, wage, contractExpires,
    // personality and reputation as for players, plus:
    "job": "Coach",                         // current job, English
    "jobId": 2,
    "preferredJobs": [2],                   // job groups with the top preference (JOB_GROUPS in schema.ts)
    "jobPreferences": [9, 12, 18, "..."],   // all 15 group scores, or null
    "attributes": { "attacking": 14, "workingWithYoungsters": 16, "...": 0 }   // app's StaffAttributeKey
  }]
}
```

Player attribute keys are the app's `PlayerAttributes` keys (`crossing` ... `concentration`,
including `teamWork`, `freeKickTaking`, `rushingOutTendency`, `punching`, `oneOnOnes`). Staff
attribute keys are the app's `StaffAttributeKey`s; adaptability is the personality value.

**FM's search result.** FM keeps the whole result of its Player Search (and Staff Search) screen
in memory, after every filter set there, including "Player's interest" (Interested, Persuadable,
Doubtful), which FM computes itself and stores nowhere per player. The reader marks the people in
that result with `inSearch` and counts them in `meta.searchPlayers` / `meta.searchStaff`: FM's own
answer to "would he join my club", not an estimate. The counts are 0 when FM had no search result.

With `--only-search` (the app's default scan mode, `DesktopSettings.scanMode` "search") the reader
writes only those people plus your own club (playing there, or owned by it and out on loan) and
sets `meta.scope` to "search"; it refuses to write a scan when FM has no search result. Without the
flag everyone is written (`meta.scope` "full") and the app can still load only the search from it
(`LoadScope.onlySearch`).

A new field is a minor change (readers ignore unknown fields). Renaming or removing one, or
changing a unit, bumps `schemaVersion`; `assertScanFile` and `assertScanHeader` reject versions they
do not know. Version 1 was a single JSON document (players and staff as arrays); version 2 is the
lines file.

## Scan database

`db/` stores a scan in SQLite (Node's built-in `node:sqlite`; Bun runs it in tests). About 7x
smaller than the JSON: a full FM27 database is about 140 MB.

| Table | Holds |
| --- | --- |
| `meta` | `schema`, `schemaVersion` and the scan's `meta` (JSON) |
| `club` | `id`, `name`, `division`, `reputation`, stored once and referenced by id |
| `nation` | `id`, `name` |
| `player` | one row per player: the fields above as columns (`in_search` is 0 or 1), one column per 1..20 value (`a_<attribute>`, `h_<hidden>`, `per_<personality>`, `pos_<position>`), transfer status as bit flags |
| `staff` | the same person columns, `job`, `job_id`, `preferred_jobs` and `job_preferences` (comma lists), one `a_<attribute>` column per staff attribute |

`PRAGMA user_version` holds `SCAN_DB_VERSION` (`db/schema.ts`); a database of another version is
rejected (scan again). Reading rows back (`db/read.ts`) gives exactly the records of the lines file.

- `db/write.ts`: `importScanLines` (streams the lines file, a transaction per 5,000 rows),
  `writeScanFile` (an in-memory scan), `scanToLines`.
- `db/read.ts`: `loadScan(db, scope)` returns what the screens load: your club plus a pool, which
  is the whole scan or, with `scope.onlySearch` on a whole-save scan, FM's search result (a scan
  that kept only the search is its own pool). A pool that fits under the
  limits is loaded whole; a bigger one keeps players at or above a CA, plus young players with a
  high PA, best CA first, up to a cap (and staff likewise). See `LoadScope` in
  `../desktop/bridge.ts`.
- `db/growth.ts`: `prepareGrowth` joins two scan databases on uid once into a small `growth` table
  in a scratch database (a few seconds for two full databases); `queryGrowth` filters, sorts and
  pages it in milliseconds.
- `db/open.ts`: opening and creating databases with `node:sqlite` (Node-side code only).
