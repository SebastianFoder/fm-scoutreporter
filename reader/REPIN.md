# Re-pinning the offsets after an FM patch

Adapted from FMSuperScout's `docs/repin-guide.md` (MIT).

The reader reads FM's memory at fixed places (offsets in `src/Fields.cs`, one layout per FM
version). A big patch (27.0 to 27.1) or a new edition (FM28) can move them. Signs: the app shows
the "game version differs" warning, and the scan has rubbish or (almost) nothing in it. With the
hints in `diagnostics.txt` this is usually hours of work, not days.

## Step 1: scan the new version

Start FM on the new patch, load a save and run
`reader/dist/ScoutReporter.Reader.exe scan --out <dir>`, or press Scan FM in the app (its files are
in the app's data folder under `scans/latest`). No game restart or mod is needed. Open
`diagnostics.txt`: it lists the pinned class offsets and the class-offset histogram.

## Step 2: pin the class offsets (`src/Fields.cs`)

A new edition gets its own layout with only the fields that moved, plus a line in
`Fields.ForVersion`. FM27 only moved the manager offset:

```csharp
public static readonly Fields FM27 = FM26.With(f =>
{
    f.Game = "FM27"; f.SupportedMajor = 27; f.SupportedMinor = 0;
    f.HUMAN_MANAGER_OFFSET = 0x440;
});
```

For a patch within the same edition, change that layout's values.

Read the histogram "Class offsets (meta+4) with a plausible UID". Patterns that held on 26.3 and
very likely come back:

- **Every class shows as two peaks exactly 0x28 apart** (for example 0x288/0x2B0). Take the lower
  one of the pair.
- **Staff facet** (`STAFF_OFFSET`, was 0x100): the biggest peak of all, about the number of people
  in the database.
- **Pure player** (`PLAYER_OFFSET`, was 0x288): the second big peak, a bit smaller than staff.
- **Player who is also staff** (`PLAYER_STAFF_OFFSET`, was 0x380): a medium peak, about 5-10% of
  the player peak.
- **Human manager** (`HUMAN_MANAGER_OFFSET`, was 0x450, FM27 0x440): a tiny peak counting your own
  managers (usually 1 or 2).

Change the four offsets, run `bun run reader:build` and scan again. In `diagnostics.txt` the player
and staff counts should be back in the tens of thousands.

## Step 3: check the field offsets (CA/PA first)

Class offsets move more often than field offsets, so you are often done now. Check the sample
players in `diagnostics.txt`: are names, ages, CA/PA and clubs right?

- **Rubbish CA/PA** (all 1, or huge): `PLAO_CA`/`PLAO_PA` moved. Find them again with a known
  player: CA and PA are two u16s next to each other, so scan a star's player block (high CA, higher
  PA) for plausible pairs. tdg6661's Cheat Engine tables (the source of the original pins) are
  usually updated soon after a patch; copying from them is faster than searching.
- **Broken names**: `PERO_FIRST_NAME`/`PERO_SECOND_NAME` (nested strings) moved.
- **Broken contract or wage**: `PERO_FULL_CONTRACT` or the `CON_*` offsets.
- **Odd attributes**: the `PLAO_ATTRS` base moved. Values are stored x5, so a known Pace 18 is the
  byte 90.

## Step 4: finish

1. Update `SupportedMajor`/`SupportedMinor` of the layout in `src/Fields.cs`.
2. Run a full scan and spot-check it in the app (known players, clubs, values, loans). Put an FM
   squad screen next to the app: age, contract, nationality and wage must match exactly (FM shows
   your currency, the scan is in GBP). Compare attribute profiles per position (GK/ST/DC) with the
   previous version: they should show the same pattern.
3. `bun run reader:test` and `bun test`, then a walk through the app.
4. Build a new desktop release.

## Reference: what pins where

| Constant | Meaning | Moves |
|---|---|---|
| `PLAYER_OFFSET` and the other class offsets (meta+4) | class recognition in the scan | often (FM27: manager only) |
| `PLAO_*` | player block (CA/PA/attributes/positions/value) | sometimes |
| `PERO_*` | person block (name/birth date/contract pointer) | rarely |
| `CON_*` | contract block (wage/expiry/status flags) | rarely |
| `TEAM_*` / `COMP_*` / `CLUB_*` | team, club and competition chain | rarely |

Every scan on a broken version is free measurement data, and the scan itself (vtable detection) is
designed to survive patches.
