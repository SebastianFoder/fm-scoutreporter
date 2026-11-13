import type { PositionSlot } from "@scoutreporter/core/position-slots";
import type { Fm27Role } from "@scoutreporter/core/fm27/benchmarks";

/** Pitch slots from the back, right to left (the order FM lists a team sheet). */
export const SLOT_ORDER: PositionSlot[] = [
  "GK",
  "DR", "DC", "DL",
  "WBR", "WBL",
  "DM",
  "MR", "MC", "ML",
  "AMR", "AMC", "AML",
  "ST",
];

export const SLOT_LABEL: Record<PositionSlot, string> = {
  GK: "GK",
  DR: "D (R)",
  DC: "D (C)",
  DL: "D (L)",
  WBR: "WB (R)",
  WBL: "WB (L)",
  DM: "DM",
  MR: "M (R)",
  MC: "M (C)",
  ML: "M (L)",
  AMR: "AM (R)",
  AMC: "AM (C)",
  AML: "AM (L)",
  ST: "ST",
};

/** FM27 benchmark role a slot is scored on unless the user picks another profile. */
export const DEFAULT_SLOT_ROLE: Record<PositionSlot, Fm27Role> = {
  GK: "GK",
  DC: "CB",
  DR: "WB/6",
  DL: "WB/6",
  WBR: "WB/6",
  WBL: "WB/6",
  DM: "WB/6",
  MC: "WB/6",
  MR: "10",
  ML: "10",
  AMR: "10",
  AMC: "10",
  AML: "10",
  ST: "9",
};

export function isPositionSlot(v: unknown): v is PositionSlot {
  return typeof v === "string" && v in SLOT_LABEL;
}

/**
 * The spots of FM's tactics pitch: five lanes (left, centre-left, centre, centre-right, right) on the
 * defence, wing-back / defensive midfield, midfield and attacking midfield lines, three up front, and
 * the keeper. Codes are FM's own (DCL, DMCR, AMCL, STC…).
 */
export type FormationSpot =
  | "GK"
  | "DL" | "DCL" | "DC" | "DCR" | "DR"
  | "WBL" | "DMCL" | "DMC" | "DMCR" | "WBR"
  | "ML" | "MCL" | "MC" | "MCR" | "MR"
  | "AML" | "AMCL" | "AMC" | "AMCR" | "AMR"
  | "STCL" | "STC" | "STCR";

/** The lines of the tactics pitch from the front, each left to right; null where FM has no spot. */
export const PITCH_ROWS: (FormationSpot | null)[][] = [
  [null, "STCL", "STC", "STCR", null],
  ["AML", "AMCL", "AMC", "AMCR", "AMR"],
  ["ML", "MCL", "MC", "MCR", "MR"],
  ["WBL", "DMCL", "DMC", "DMCR", "WBR"],
  ["DL", "DCL", "DC", "DCR", "DR"],
  [null, null, "GK", null, null],
];

/** Every spot from the back, right to left: FM's team sheet order. */
export const SPOT_ORDER: FormationSpot[] = PITCH_ROWS.slice()
  .reverse()
  .flatMap((row) => row.slice().reverse())
  .filter((s): s is FormationSpot => s !== null);

/** The export position a spot needs: all three centre-backs need D (C), and so on. */
export const SPOT_SLOT: Record<FormationSpot, PositionSlot> = {
  GK: "GK",
  DL: "DL", DCL: "DC", DC: "DC", DCR: "DC", DR: "DR",
  WBL: "WBL", DMCL: "DM", DMC: "DM", DMCR: "DM", WBR: "WBR",
  ML: "ML", MCL: "MC", MC: "MC", MCR: "MC", MR: "MR",
  AML: "AML", AMCL: "AMC", AMC: "AMC", AMCR: "AMC", AMR: "AMR",
  STCL: "ST", STC: "ST", STCR: "ST",
};

const LANE_X = [7, 20.5, 34, 47.5, 61];
const ROW_Y = [13, 29, 46, 62, 78, 92];

/** Spot centres on the 68 × 100 vertical pitch (attacking upwards). */
export const SPOT_XY = Object.fromEntries(
  PITCH_ROWS.flatMap((row, r) =>
    row.flatMap((spot, lane) => (spot ? [[spot, [LANE_X[lane], ROW_Y[r]]]] : [])),
  ),
) as Record<FormationSpot, [number, number]>;

export function isFormationSpot(v: unknown): v is FormationSpot {
  return typeof v === "string" && v in SPOT_SLOT;
}

export interface Formation {
  id: string;
  name: string;
  /** Eleven distinct spots in team sheet order, one of them GK. */
  spots: FormationSpot[];
  /** The export position each spot needs. */
  slots: PositionSlot[];
}

/** Spots sorted into team sheet order. */
export function sortSpots(spots: FormationSpot[]): FormationSpot[] {
  return [...spots].sort((a, b) => SPOT_ORDER.indexOf(a) - SPOT_ORDER.indexOf(b));
}

export function formation(id: string, name: string, spots: string): Formation {
  const list = sortSpots(spots.split(/\s+/) as FormationSpot[]);
  return { id, name, spots: list, slots: list.map((s) => SPOT_SLOT[s]) };
}

/** Eleven distinct spots with exactly one keeper. */
export function isValidFormation(spots: FormationSpot[]): boolean {
  return (
    spots.length === 11 &&
    new Set(spots).size === 11 &&
    spots.every(isFormationSpot) &&
    spots.filter((s) => s === "GK").length === 1
  );
}

/** FM's preset formations, named the way FM's tactics screen names them. */
export const FORMATIONS: Formation[] = [
  formation("4-2-3-1", "4-2-3-1 DM AM Wide", "GK DR DCR DCL DL DMCR DMCL AMR AMC AML STC"),
  formation("4-2-3-1-narrow", "4-2-3-1 DM AM Narrow", "GK DR DCR DCL DL DMCR DMCL AMCR AMC AMCL STC"),
  formation("4-3-3", "4-3-3 DM Wide", "GK DR DCR DCL DL DMC MCR MCL AMR AML STC"),
  formation("4-3-3-wide", "4-3-3 Wide", "GK DR DCR DCL DL MCR MC MCL AMR AML STC"),
  formation("4-1-4-1", "4-1-4-1 DM Wide", "GK DR DCR DCL DL DMC MR MCR MCL ML STC"),
  formation("4-4-2", "4-4-2", "GK DR DCR DCL DL MR MCR MCL ML STCR STCL"),
  formation("4-4-1-1", "4-4-1-1", "GK DR DCR DCL DL MR MCR MCL ML AMC STC"),
  formation("4-4-2-dm", "4-4-2 DM Wide", "GK DR DCR DCL DL DMCR DMCL MR ML STCR STCL"),
  formation("4-1-2-1-2", "4-1-2-1-2 DM AM Narrow (diamond)", "GK DR DCR DCL DL DMC MCR MCL AMC STCR STCL"),
  formation("4-3-1-2", "4-3-1-2 Narrow", "GK DR DCR DCL DL MCR MC MCL AMC STCR STCL"),
  formation("4-3-2-1", "4-3-2-1 Narrow", "GK DR DCR DCL DL MCR MC MCL AMCR AMCL STC"),
  formation("4-2-2-2", "4-2-2-2 DM AM Narrow", "GK DR DCR DCL DL DMCR DMCL AMCR AMCL STCR STCL"),
  formation("4-2-4", "4-2-4 DM Wide", "GK DR DCR DCL DL DMCR DMCL AMR AML STCR STCL"),
  formation("4-5-1", "4-5-1", "GK DR DCR DCL DL MR MCR MC MCL ML STC"),
  formation("3-5-2", "3-5-2 DM WB", "GK DCR DC DCL WBR WBL DMC MCR MCL STCR STCL"),
  formation("3-4-3", "3-4-3 WB", "GK DCR DC DCL WBR WBL MCR MCL AMR AML STC"),
  formation("3-4-3-wide", "3-4-3 Wide", "GK DCR DC DCL MR MCR MCL ML AMR AML STC"),
  formation("3-4-1-2", "3-4-1-2", "GK DCR DC DCL MR MCR MCL ML AMC STCR STCL"),
  formation("3-4-2-1", "3-4-2-1", "GK DCR DC DCL MR MCR MCL ML AMCR AMCL STC"),
  formation("5-3-2", "5-3-2", "GK DR DCR DC DCL DL MCR MC MCL STCR STCL"),
  formation("5-3-2-wb", "5-3-2 WB", "GK DCR DC DCL WBR WBL MCR MC MCL STCR STCL"),
  formation("5-2-1-2", "5-2-1-2 WB", "GK DCR DC DCL WBR WBL MCR MCL AMC STCR STCL"),
  formation("5-4-1", "5-4-1", "GK DR DCR DC DCL DL MR MCR MCL ML STC"),
];

export const DEFAULT_FORMATION = FORMATIONS[0];

/** The preset with exactly these spots, if any. */
export function findFormation(spots: FormationSpot[], list: Formation[] = FORMATIONS): Formation | undefined {
  const key = sortSpots(spots).join(" ");
  return list.find((f) => f.spots.join(" ") === key);
}

/** Centre spots a line uses for 1, 2 or 3 players: one in the middle, a pair, then all three. */
const CENTRE_SPOTS: Partial<Record<PositionSlot, FormationSpot[][]>> = {
  DC: [["DC"], ["DCR", "DCL"], ["DCR", "DC", "DCL"]],
  DM: [["DMC"], ["DMCR", "DMCL"], ["DMCR", "DMC", "DMCL"]],
  MC: [["MC"], ["MCR", "MCL"], ["MCR", "MC", "MCL"]],
  AMC: [["AMC"], ["AMCR", "AMCL"], ["AMCR", "AMC", "AMCL"]],
  ST: [["STC"], ["STCR", "STCL"], ["STCR", "STC", "STCL"]],
};

/**
 * Spots for a line-up given only as export positions (settings saved before the tactics pitch),
 * in the same order, or null when they cannot be laid out (e.g. four centre-backs or two left-backs).
 */
export function spotsForSlots(slots: PositionSlot[]): FormationSpot[] | null {
  const count = new Map<PositionSlot, number>();
  for (const s of slots) count.set(s, (count.get(s) ?? 0) + 1);
  const seen = new Map<PositionSlot, number>();
  const out: FormationSpot[] = [];
  for (const slot of slots) {
    const i = seen.get(slot) ?? 0;
    seen.set(slot, i + 1);
    const n = count.get(slot)!;
    const centre = CENTRE_SPOTS[slot];
    if (centre) {
      if (n > 3) return null;
      out.push(centre[n - 1][i]);
    } else {
      if (n > 1) return null;
      out.push(slot as FormationSpot);
    }
  }
  return isValidFormation(out) ? out : null;
}
