# Scan format (`scoutreporter-scan`, version 1)

The file the reader (`reader/`, `ScoutReporter.Reader.exe scan`) writes and the desktop app loads.
TypeScript types: `schema.ts`. Conversion to the app's import records: `convert.ts`. Growth between
two scans: `growth.ts`. Example: `../fixtures/scan-sample.json` (built from the CSV fixtures by
`../fixtures/make-scan-sample.ts`).

Conventions: money in GBP (FM's internal currency) as whole numbers, dates as `yyyy-mm-dd`,
attributes and personality as 1..20. Unknown values are `null`.

```jsonc
{
  "schema": "scoutreporter-scan",
  "schemaVersion": 1,
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
    "unreadFraction": 0.0                   // share of FM's memory that could not be read
  },
  "players": [{
    "uid": 2002083882,
    "name": "Alex Williamson",
    "birthDate": "2007-02-01",
    "age": 20,
    "nationality": "United States",         // in the game's language
    "nationId": 123,                        // optional, language independent
    "female": true,                         // only when true
    "club": "Club where he plays",
    "ownerClub": "Parent club",             // only for loans
    "division": "Competition",
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

A new field is a minor change (readers ignore unknown fields). Renaming or removing one, or
changing a unit, bumps `schemaVersion`; `assertScanFile` rejects versions it does not know.
