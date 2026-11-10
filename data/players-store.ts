import fs from "fs";
import path from "path";
import { parsePlayersCsv } from "@/lib/parser/csv-parser";
import { groupPlayerAttributes } from "@/lib/parser/attribute-grouper";
import type { PlayerAttributes } from "@/types/player-attributes";
import type { GroupedAttributes } from "@/types/grouped-attributes";
import type { PotentialProjection } from "@/lib/fm27/potential";

export interface PlayerWithGroups {
  raw: PlayerAttributes;
  grouped: GroupedAttributes;
  /** Projected attributes at PA; only for v2 exports (CA + PA columns). */
  potential?: PotentialProjection | null;
}

let cache: PlayerWithGroups[] | null = null;

export function getPlayers(): PlayerWithGroups[] {
  if (cache) return cache;

  const csvPath = path.join(
    process.cwd(),
    "app",
    "temp",
    "player_export_20260317_220233.csv",
  );
  const csv = fs.readFileSync(csvPath, "utf8");
  const parsed = parsePlayersCsv(csv);

  cache = parsed.map((p) => ({
    raw: p,
    grouped: groupPlayerAttributes(p),
  }));

  return cache!;
}
