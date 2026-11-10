import type { PositionSlot } from "@/lib/position-slots";
import { SLOT_XY } from "@/lib/position-slots";
import type { Fm27Role } from "@/lib/fm27/benchmarks";

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

export interface Formation {
  id: string;
  name: string;
  slots: PositionSlot[];
}

export const FORMATIONS: Formation[] = [
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: ["GK", "DR", "DC", "DC", "DL", "DM", "DM", "AMR", "AMC", "AML", "ST"],
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: ["GK", "DR", "DC", "DC", "DL", "DM", "MC", "MC", "AMR", "AML", "ST"],
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: ["GK", "DR", "DC", "DC", "DL", "MR", "MC", "MC", "ML", "ST", "ST"],
  },
  {
    id: "4-3-1-2",
    name: "4-3-1-2 (narrow)",
    slots: ["GK", "DR", "DC", "DC", "DL", "MC", "MC", "MC", "AMC", "ST", "ST"],
  },
  {
    id: "3-5-2",
    name: "3-5-2 (wing-backs)",
    slots: ["GK", "DC", "DC", "DC", "WBR", "WBL", "DM", "MC", "MC", "ST", "ST"],
  },
  {
    id: "3-4-3",
    name: "3-4-3 (wing-backs)",
    slots: ["GK", "DC", "DC", "DC", "WBR", "WBL", "MC", "MC", "AMR", "AML", "ST"],
  },
  {
    id: "5-3-2",
    name: "5-3-2",
    slots: ["GK", "DR", "DC", "DC", "DC", "DL", "MC", "MC", "MC", "ST", "ST"],
  },
];

export const DEFAULT_FORMATION = FORMATIONS[0];

export function isPositionSlot(v: unknown): v is PositionSlot {
  return typeof v === "string" && v in SLOT_XY;
}

/**
 * Where to draw each slot of a line-up on the 68 × 100 pitch. Slots used more than once
 * (two centre-backs, two strikers) are spread out instead of stacked on one point.
 */
export function pitchLayout(slots: PositionSlot[]): [number, number][] {
  const total = new Map<PositionSlot, number>();
  for (const s of slots) total.set(s, (total.get(s) ?? 0) + 1);
  const crowdedBackLine = (total.get("DC") ?? 0) >= 3;

  const seen = new Map<PositionSlot, number>();
  return slots.map((slot) => {
    const n = total.get(slot) ?? 1;
    const i = seen.get(slot) ?? 0;
    seen.set(slot, i + 1);

    let [x, y] = SLOT_XY[slot];
    // Full-backs step up beside a back three so the five do not overlap.
    if (crowdedBackLine && (slot === "DL" || slot === "DR")) y -= 9;
    if (n === 1) return [x, y];

    const offset = i - (n - 1) / 2;
    if (x === 34) {
      const spacing = n === 2 ? 15 : Math.min(14, 56 / (n - 1));
      // Mirror so the first of a group sits on the right, like the slot order.
      x = 34 - offset * spacing;
    } else {
      y += offset * 11;
    }
    return [x, y];
  });
}
