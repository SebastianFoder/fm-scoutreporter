/**
 * Map an FM position string ("D/WB (R), DM, M (C)", "AM (RLC), ST (C)") to the
 * pitch slots it covers, for drawing a position map.
 */
export type PositionSlot =
  | "GK"
  | "DL" | "DC" | "DR"
  | "WBL" | "WBR"
  | "DM"
  | "ML" | "MC" | "MR"
  | "AML" | "AMC" | "AMR"
  | "ST";

const SIDED: Record<string, { L: PositionSlot; C?: PositionSlot; R: PositionSlot }> = {
  D: { L: "DL", C: "DC", R: "DR" },
  WB: { L: "WBL", R: "WBR" },
  M: { L: "ML", C: "MC", R: "MR" },
  AM: { L: "AML", C: "AMC", R: "AMR" },
};

export function parsePositionSlots(position: string): PositionSlot[] {
  const out = new Set<PositionSlot>();

  for (const rawToken of position.split(",")) {
    const token = rawToken.trim().toUpperCase();
    if (!token) continue;
    const m = token.match(/^([A-Z/]+)\s*(?:\(([RLC]+)\))?$/);
    if (!m) continue;
    const roles = m[1].split("/").filter(Boolean);
    const sides = m[2] ?? "";

    for (const role of roles) {
      if (role === "GK") out.add("GK");
      else if (role === "DM") out.add("DM");
      else if (role === "ST") out.add("ST");
      else if (SIDED[role]) {
        const s = SIDED[role];
        const wanted = sides || (s.C ? "C" : "LR");
        if (wanted.includes("L")) out.add(s.L);
        if (wanted.includes("R")) out.add(s.R);
        if (wanted.includes("C") && s.C) out.add(s.C);
      }
    }
  }

  return [...out];
}

/** Slot centres on a 68 × 100 vertical pitch (attacking upwards). */
export const SLOT_XY: Record<PositionSlot, [number, number]> = {
  ST: [34, 14],
  AML: [10, 28],
  AMC: [34, 30],
  AMR: [58, 28],
  ML: [10, 46],
  MC: [34, 48],
  MR: [58, 46],
  WBL: [8, 62],
  DM: [34, 63],
  WBR: [60, 62],
  DL: [12, 76],
  DC: [34, 79],
  DR: [56, 76],
  GK: [34, 92],
};
