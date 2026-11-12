/**
 * Growth between two scans of the same save: how much each player's CA, PA and attributes changed
 * since an earlier scan. Players only in the newer scan (youth intake, newly loaded leagues) have no
 * baseline and are counted separately.
 */
import type { ScanFile, ScanPlayer } from "./schema";

export interface AttributeChange {
  key: string;
  from: number;
  to: number;
}

export interface PlayerGrowth {
  player: ScanPlayer;
  caFrom: number;
  caChange: number;
  paChange: number;
  /** Sum of all visible attribute changes. */
  attributeChange: number;
  /** Attributes that changed, biggest change first. */
  changes: AttributeChange[];
  ageFrom: number | null;
}

export interface GrowthReport {
  rows: PlayerGrowth[];
  /** Players in the newer scan without a baseline in the older one. */
  newPlayers: ScanPlayer[];
  /** In-game days between the scans, when both have a date. */
  days: number | null;
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

export function compareScans(older: ScanFile, newer: ScanFile): GrowthReport {
  const before = new Map(older.players.map((p) => [p.uid, p]));
  const rows: PlayerGrowth[] = [];
  const newPlayers: ScanPlayer[] = [];
  for (const p of newer.players) {
    const prev = before.get(p.uid);
    if (!prev) {
      newPlayers.push(p);
      continue;
    }
    const changes: AttributeChange[] = [];
    let attributeChange = 0;
    for (const [key, to] of Object.entries(p.attributes)) {
      const from = prev.attributes[key];
      if (from === undefined || from === to) continue;
      changes.push({ key, from, to });
      attributeChange += to - from;
    }
    changes.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.key.localeCompare(b.key));
    rows.push({
      player: p,
      caFrom: prev.ca,
      caChange: p.ca - prev.ca,
      paChange: p.pa - prev.pa,
      attributeChange,
      changes,
      ageFrom: prev.age,
    });
  }
  return { rows, newPlayers, days: daysBetween(older.meta.gameDate, newer.meta.gameDate) };
}

export type GrowthSort = "caChange" | "attributeChange" | "paChange" | "ca" | "age" | "name";

export interface GrowthFilter {
  /** Only players who gained at least this much CA. */
  minCaGain?: number;
  maxAge?: number;
  query?: string;
}

export function filterGrowth(rows: PlayerGrowth[], f: GrowthFilter): PlayerGrowth[] {
  const q = f.query?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (f.minCaGain === undefined || r.caChange >= f.minCaGain) &&
      (f.maxAge === undefined || (r.player.age ?? 0) <= f.maxAge) &&
      (!q || r.player.name.toLowerCase().includes(q) || (r.player.club ?? "").toLowerCase().includes(q)),
  );
}

export function sortGrowth(rows: PlayerGrowth[], sort: GrowthSort, dir: "asc" | "desc" = "desc"): PlayerGrowth[] {
  const m = dir === "asc" ? 1 : -1;
  const value = (r: PlayerGrowth): number | string => {
    switch (sort) {
      case "caChange":
        return r.caChange;
      case "attributeChange":
        return r.attributeChange;
      case "paChange":
        return r.paChange;
      case "ca":
        return r.player.ca;
      case "age":
        return r.player.age ?? 0;
      case "name":
        return r.player.name.toLowerCase();
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const c = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return m * c || b.caChange - a.caChange;
  });
}
