import { csvLines, detectDelimiter, splitCsvLine } from "@scoutreporter/core/parser/csv-utils";

/**
 * Columns only the Squad views export (see the FM View Exporter column reference,
 * github.com/ElectroHugin/FM-View-Exporter, docs/columns/fm27.csv). The player parser ignores them;
 * Squad analysis reads them per player by Unique ID.
 */
export interface SquadFields {
  /** FM team sheet: the position the player is picked at ("D (C)"), "S1"… for the bench, or null. */
  picked: string | null;
  /** Info flags ("Inj", "Wnt"…). Only "Inj" is used: the other codes are not documented. */
  info: string | null;
  /** Agreed playing time (squad status): "Star Player", "Important Player", "Out On Loan"… */
  playingTime: string | null;
  /** Current injury, or null when fit. */
  injury: string | null;
  /** Time missed through injury, in days. */
  timeMissedDays: number | null;
  happiness: string | null;
  personality: string | null;
  /** Coach report stars, 0–5, relative to your own squad. Not CA/PA. */
  abilityStars: number | null;
  potentialStars: number | null;
}

/** Which squad-only columns the export had, so the page only offers what it can use. */
export interface SquadColumns {
  picked: boolean;
  playingTime: boolean;
  injury: boolean;
  timeMissed: boolean;
  happiness: boolean;
  personality: boolean;
  stars: boolean;
}

export interface ParsedSquadFields {
  byId: Map<string, SquadFields>;
  columns: SquadColumns;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "-", "" and "N/A" mean nothing. */
function text(v: string | undefined): string | null {
  const t = v?.trim() ?? "";
  return t === "" || t === "-" || t.toUpperCase() === "N/A" ? null : t;
}

function stars(v: string | undefined): number | null {
  const t = v?.trim() ?? "";
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 5 ? n : null;
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

/** "9 days", "3 weeks", "2 months" in days; null when unreadable. */
export function parseTimeMissed(v: string | null | undefined): number | null {
  const m = v?.trim().match(/^(\d+)\s*(day|week|month|year)s?$/i);
  return m ? Number(m[1]) * UNIT_DAYS[m[2].toLowerCase()] : null;
}

export function parseSquadFields(csv: string): ParsedSquadFields {
  const lines = csvLines(csv);
  const byId = new Map<string, SquadFields>();
  const none: SquadColumns = {
    picked: false,
    playingTime: false,
    injury: false,
    timeMissed: false,
    happiness: false,
    personality: false,
    stars: false,
  };
  if (lines.length <= 1) return { byId, columns: none };

  const delimiter = detectDelimiter(lines[0]);
  const index = new Map<string, number>();
  splitCsvLine(lines[0], delimiter).forEach((h, i) => {
    const n = norm(h);
    if (!index.has(n)) index.set(n, i);
  });
  // "Ability" / "Potential" are the coach's star ratings; the hidden values are "CA" / "PA".
  const columns: SquadColumns = {
    picked: index.has("picked"),
    playingTime: index.has("playingtime"),
    injury: index.has("injury") || index.has("inf"),
    timeMissed: index.has("timemissed"),
    happiness: index.has("happiness"),
    personality: index.has("personality"),
    stars: index.has("ability") && index.has("potential"),
  };
  const idCol = index.get("uniqueid") ?? index.get("uid");
  if (idCol === undefined) return { byId, columns: none };

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line, delimiter);
    const get = (h: string) => {
      const i = index.get(h);
      return i === undefined ? undefined : cols[i];
    };
    const id = cols[idCol]?.trim();
    if (!id) continue;
    const timeMissed = text(get("timemissed"));
    byId.set(id, {
      picked: text(get("picked")),
      info: text(get("inf")),
      playingTime: text(get("playingtime")),
      injury: text(get("injury")),
      timeMissedDays: parseTimeMissed(timeMissed),
      happiness: text(get("happiness")),
      personality: text(get("personality")),
      abilityStars: columns.stars ? stars(get("ability")) : null,
      potentialStars: columns.stars ? stars(get("potential")) : null,
    });
  }
  return { byId, columns };
}

/** Out on loan at another club: not available to pick. */
export function isOnLoan(f: SquadFields | undefined): boolean {
  return f?.playingTime?.toLowerCase() === "out on loan";
}

/** Injured now (the Injury column, or the "Inj" info flag). */
export function isInjured(f: SquadFields | undefined): boolean {
  return Boolean(f?.injury) || /\binj\b/i.test(f?.info ?? "");
}

/** In FM's starting eleven: picked at a position rather than on the bench (S1, S2…). */
export function isPickedToStart(f: SquadFields | undefined): boolean {
  return Boolean(f?.picked) && !/^S\d+$/i.test(f!.picked!);
}

/** Squad statuses that promise a regular starting place. */
const STARTER_STATUSES = ["star player", "important player", "regular starter", "first-choice goalkeeper"];
/** Squad statuses that promise little football, though no development minutes either. */
const BACKUP_STATUSES = [
  "squad player",
  "impact sub",
  "fringe player",
  "not needed",
  "cup goalkeeper",
  "domestic cup goalkeeper",
];

export type StatusTier = "starter" | "backup" | "prospect" | "other";

export function statusTier(playingTime: string | null | undefined): StatusTier {
  const s = playingTime?.toLowerCase() ?? "";
  if (STARTER_STATUSES.includes(s)) return "starter";
  if (BACKUP_STATUSES.includes(s)) return "backup";
  if (/prospect|youngster/.test(s)) return "prospect";
  return "other";
}
