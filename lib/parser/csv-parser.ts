import { PlayerAttributes } from "@/types/player-attributes";
import { csvLines, detectDelimiter, splitCsvLine } from "./csv-utils";

type NumKey = {
  [K in keyof PlayerAttributes]: PlayerAttributes[K] extends number ? K : never;
}[keyof PlayerAttributes];

/** Header (normalised) → numeric attribute field. */
const NUMERIC_COLUMNS: Record<string, NumKey> = {
  crossing: "crossing",
  handling: "handling",
  concentration: "concentration",
  aggression: "aggression",
  leadership: "leadership",
  positioning: "positioning",
  teamwork: "teamWork",
  acceleration: "acceleration",
  penaltytaking: "penaltyTaking",
  age: "age",
  technique: "technique",
  tackling: "tackling",
  heading: "heading",
  marking: "marking",
  longthrows: "longThrows",
  pace: "pace",
  corners: "corners",
  stamina: "stamina",
  strength: "strength",
  reflexes: "reflexes",
  naturalfitness: "naturalFitness",
  balance: "balance",
  jumpingreach: "jumpingReach",
  agility: "agility",
  workrate: "workRate",
  decisions: "decisions",
  determination: "determination",
  rushingouttendency: "rushingOutTendency",
  rushingout: "rushingOutTendency",
  anticipation: "anticipation",
  composure: "composure",
  bravery: "bravery",
  throwing: "throwing",
  punching: "punching",
  punchingtendency: "punching",
  oneonones: "oneOnOnes",
  kicking: "kicking",
  eccentricity: "eccentricity",
  dribbling: "dribbling",
  freekicktaking: "freeKickTaking",
  finishing: "finishing",
  firsttouch: "firstTouch",
  flair: "flair",
  longshots: "longShots",
  offtheball: "offTheBall",
  passing: "passing",
  vision: "vision",
  commandofarea: "commandOfArea",
  communication: "communication",
  aerialreach: "aerialReach",
};

const OPTIONAL_NUMERIC_COLUMNS: Record<string, "professionalism" | "currentAbility" | "potentialAbility"> = {
  professionalism: "professionalism",
  ca: "currentAbility",
  currentability: "currentAbility",
  pa: "potentialAbility",
  potentialability: "potentialAbility",
};

/**
 * Column order of the v1 view (SCOUT REPORTER Attributes v1), used when a header can't be matched.
 * Index → normalised header.
 */
const V1_ORDER = [
  "player", "crossing", "handling", "concentration", "aggression", "leadership", "positioning", "teamwork",
  "acceleration", "penaltytaking", "expires", "wage", "rightfoot", "leftfoot", "age", "eunational", "position",
  "uniqueid", "technique", "tackling", "heading", "marking", "longthrows", "pace", "corners", "stamina",
  "strength", "reflexes", "naturalfitness", "balance", "jumpingreach", "agility", "workrate", "decisions",
  "determination", "rushingouttendency", "anticipation", "composure", "bravery", "throwing", "punching",
  "oneonones", "kicking", "eccentricity", "dribbling", "freekicktaking", "finishing", "firsttouch", "flair",
  "longshots", "offtheball", "passing", "vision", "commandofarea", "transfervalue", "communication",
  "aerialreach",
];

const ALIASES: Record<string, string> = {
  salary: "wage",
  name: "player",
  uid: "uniqueid",
};

function normalizeHeader(h: string): string {
  const n = h.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ALIASES[n] ?? n;
}

function numeric(v: string): number {
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** CA/PA/Professionalism: null when missing, hidden ("-", "?") or a range FM shows for unknown values. */
function optionalNumeric(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parsePlayersCsv(csv: string): PlayerAttributes[] {
  const lines = csvLines(csv);

  if (lines.length <= 1) return [];

  // FM26 exports are `;`-delimited, FM27 exports are `,`-delimited (and call "Wage" "Salary").
  // Columns are matched by header so both the v1 and v2 (+ Professionalism, CA, PA) views work.
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const index = new Map<string, number>();
  headers.forEach((h, i) => {
    if (!index.has(h)) index.set(h, i);
  });
  // Fall back to the v1 fixed order for anything the header didn't name.
  V1_ORDER.forEach((h, i) => {
    if (!index.has(h) && headers.length === V1_ORDER.length) index.set(h, i);
  });

  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delimiter);
    const get = (key: string): string => {
      const i = index.get(key);
      return i === undefined ? "" : (cols[i] ?? "").trim();
    };
    const strOrNull = (key: string): string | null => {
      const v = get(key);
      if (!v || v === "N/A" || v === "€0") return null;
      return v;
    };

    const row = {
      player: get("player"),
      expires: get("expires"),
      wage: strOrNull("wage"),
      rightFoot: get("rightfoot"),
      leftFoot: get("leftfoot"),
      euNational: get("eunational") === "True",
      position: get("position"),
      uniqueId: get("uniqueid"),
      transferValueRange: strOrNull("transfervalue"),
      professionalism: null,
      currentAbility: null,
      potentialAbility: null,
    } as unknown as PlayerAttributes;

    // Two headers can alias one field (e.g. "Rushing Out" / "Rushing Out (Tendency)"): the first present wins.
    for (const [header, field] of Object.entries(NUMERIC_COLUMNS)) {
      if (row[field] === undefined && index.has(header)) row[field] = numeric(get(header));
    }
    for (const field of Object.values(NUMERIC_COLUMNS)) {
      if (row[field] === undefined) row[field] = 0;
    }
    for (const [header, field] of Object.entries(OPTIONAL_NUMERIC_COLUMNS)) {
      if (!index.has(header) || row[field] !== null) continue;
      row[field] = optionalNumeric(cols[index.get(header)!]);
    }

    return row;
  });
}
