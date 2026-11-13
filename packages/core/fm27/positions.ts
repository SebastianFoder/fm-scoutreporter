import type { PositionGroup } from "./ca-costs";

/**
 * Turn an FM position string such as "D/WB (R), DM, M (C)" or "AM (RLC), ST (C)"
 * into the FM27 CA-cost position groups it covers, in the order FM lists them.
 */
export function parsePositionGroups(position: string): PositionGroup[] {
  const out: PositionGroup[] = [];
  const add = (g: PositionGroup) => {
    if (!out.includes(g)) out.push(g);
  };

  for (const rawToken of position.split(",")) {
    const token = rawToken.trim().toUpperCase();
    if (!token) continue;
    const m = token.match(/^([A-Z/]+)\s*(?:\(([RLC]+)\))?$/);
    if (!m) continue;
    const roles = m[1].split("/").filter(Boolean);
    const sides = m[2] ?? "";
    const central = sides === "" || sides.includes("C");
    const wide = sides.includes("R") || sides.includes("L");

    for (const role of roles) {
      switch (role) {
        case "GK":
          add("GK");
          break;
        case "D":
          if (central) add("CB");
          if (wide) add("FB");
          break;
        case "WB":
          add("WB");
          break;
        case "DM":
          add("DM");
          break;
        case "M":
          if (central) add("CM");
          if (wide) add("WM");
          break;
        case "AM":
          if (central) add("AMC");
          if (wide) add("AMW");
          break;
        case "ST":
          add("ST");
          break;
      }
    }
  }

  return out;
}
