/**
 * Turn a desktop scan into the same records the CSV parsers produce, so scoring, Wonderkid, Best XI,
 * Squad and Staff mode work on a scan unchanged. Strings are formatted the way FM's export writes
 * them (positions, money, dates), because parts of the app read those strings.
 */
import { ALL_ATTRIBUTE_KEYS } from "@scoutreporter/core/attribute-keys";
import { formatMoney } from "@scoutreporter/core/best-xi/money";
import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";
import type { StaffMember } from "@scoutreporter/core/staff/staff-parser";
import {
  STAFF_ATTRIBUTES,
  bandForValue,
  type StaffAttributeKey,
  type StaffRating,
} from "@scoutreporter/core/staff/staff-attributes";
import { JOB_GROUPS, type ScanFile, type ScanPlayer, type ScanPositionKey, type ScanStaff } from "./schema";

/** A position counts once FM rates the player Accomplished there (15+), like FM's position column. */
export const PLAYABLE_RATING = 15;

const SIDES = ["R", "L", "C"] as const;

/** Lines in FM's order, with the spot per side. */
const LINES: { label: string; spots: Partial<Record<(typeof SIDES)[number], ScanPositionKey>> }[] = [
  { label: "GK", spots: { C: "GK" } },
  { label: "D", spots: { R: "DR", L: "DL", C: "DC" } },
  { label: "WB", spots: { R: "WBR", L: "WBL" } },
  { label: "DM", spots: { C: "DM" } },
  { label: "M", spots: { R: "MR", L: "ML", C: "MC" } },
  { label: "AM", spots: { R: "AMR", L: "AML", C: "AMC" } },
  { label: "ST", spots: { C: "ST" } },
];

/**
 * FM's position string ("D (RC), DM, M (C)") from position ratings. Single-spot lines (GK, DM) have
 * no sides, matching the export. With no position at 15+, the best-rated one is used.
 */
export function positionString(ratings: Partial<Record<ScanPositionKey, number>>, min = PLAYABLE_RATING): string {
  const best = Math.max(0, ...Object.values(ratings).map((v) => v ?? 0));
  const threshold = best >= min ? min : best;
  if (threshold <= 0) return "";
  const parts: string[] = [];
  for (const line of LINES) {
    const sides = SIDES.filter((s) => {
      const spot = line.spots[s];
      return spot !== undefined && (ratings[spot] ?? 0) >= threshold;
    });
    if (sides.length === 0) continue;
    const single = Object.keys(line.spots).length === 1;
    parts.push(single ? line.label : `${line.label} (${sides.join("")})`);
  }
  return parts.join(", ");
}

/** FM's foot words from the 1..20 foot rating. */
export function footWord(rating: number): string {
  if (rating >= 18) return "Very Strong";
  if (rating >= 15) return "Strong";
  if (rating >= 12) return "Fairly Strong";
  if (rating >= 9) return "Reasonable";
  if (rating >= 5) return "Weak";
  return "Very Weak";
}

/** "2030-06-30" -> "30/06/2030", as FM's export writes dates. */
export function fmDate(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** EU member states (English names; FM in another language reports nations in that language). */
const EU_NATIONS = new Set(
  [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Czechia", "Denmark", "Estonia",
    "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Republic of Ireland", "Italy", "Latvia",
    "Lithuania", "Luxembourg", "Malta", "Netherlands", "Holland", "Poland", "Portugal", "Romania", "Slovakia",
    "Slovenia", "Spain", "Sweden",
  ].map((n) => n.toLowerCase()),
);

export function isEuNation(nation: string | null): boolean {
  return nation !== null && EU_NATIONS.has(nation.trim().toLowerCase());
}

const GBP = "£";

/** "£4,138": wages stay exact (the export rounds them, the scan does not). */
function exactMoney(amount: number): string {
  return `${GBP}${Math.round(amount).toLocaleString("en-GB")}`;
}

/** A scanned player as the CSV parser would have produced it (with CA, PA and Professionalism). */
export function scanPlayerToAttributes(p: ScanPlayer): PlayerAttributes {
  const attrs = {} as Record<string, number>;
  for (const key of ALL_ATTRIBUTE_KEYS) attrs[key] = p.attributes[key] ?? 0;
  return {
    ...(attrs as unknown as Pick<PlayerAttributes, (typeof ALL_ATTRIBUTE_KEYS)[number]>),
    player: p.name,
    uniqueId: String(p.uid),
    position: positionString(p.positions),
    age: p.age ?? 0,
    euNational: isEuNation(p.nationality),
    expires: fmDate(p.contractExpires),
    wage: p.wage === null ? null : `${exactMoney(p.wage)} p/w`,
    transferValueRange: p.value === null ? null : formatMoney(p.value, GBP),
    rightFoot: footWord(p.foot.right),
    leftFoot: footWord(p.foot.left),
    professionalism: p.personality.professionalism,
    currentAbility: p.ca,
    potentialAbility: p.pa,
  } as PlayerAttributes;
}

/** The preferred job name: the top preference group, else the current job. */
export function preferredJobName(s: ScanStaff): string {
  for (const g of s.preferredJobs) {
    const name = JOB_GROUPS[g];
    if (name) return name;
  }
  return s.job ?? "";
}

function exactRating(value: number | undefined): StaffRating | null {
  if (value === undefined || value < 1 || value > 20) return null;
  return { band: bandForValue(value), value, exact: true };
}

/** A scanned staff member as the Staff CSV parser would have produced it, with exact 1..20 ratings. */
export function scanStaffToMember(s: ScanStaff): StaffMember {
  const attributes = {} as Record<StaffAttributeKey, StaffRating | null>;
  for (const def of STAFF_ATTRIBUTES) attributes[def.key] = exactRating(s.attributes[def.key]);
  return {
    uniqueId: String(s.uid),
    name: s.name,
    status: s.club ? "" : "FrA",
    preferredJob: preferredJobName(s),
    club: s.club ?? "",
    personality: "",
    euNational: isEuNation(s.nationality),
    age: s.age,
    nationality: s.nationality ?? "",
    attributes,
  };
}

/** Staff attributes a scan always has (every key the app knows). */
export const SCAN_STAFF_COLUMNS: StaffAttributeKey[] = STAFF_ATTRIBUTES.map((a) => a.key);

export interface ScanFilter {
  /** Keep only players at this club (squad mode). */
  club?: string;
}

export function scanPlayers(scan: Pick<ScanFile, "players">, filter: ScanFilter = {}): PlayerAttributes[] {
  const players = filter.club ? scan.players.filter((p) => p.club === filter.club) : scan.players;
  return players.map(scanPlayerToAttributes);
}

export function scanStaff(scan: Pick<ScanFile, "staff">): StaffMember[] {
  return scan.staff.map(scanStaffToMember);
}
