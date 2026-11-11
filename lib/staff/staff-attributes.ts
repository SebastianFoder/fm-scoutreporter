/**
 * FM26 staff attributes. FM26 shows staff attributes as words instead of 1–20 numbers; each word covers a
 * fixed range on the old scale (community-mapped against FM24): Unsuited 1–3, Reasonable 4–6, Competent 7–9,
 * Average 10–11, Good 12–14, Very Good 15–17, Outstanding 18–19, Elite 20.
 */

export type StaffAttributeKey =
  | "attacking"
  | "defending"
  | "fitness"
  | "goalkeeping"
  | "possession"
  | "setPieces"
  | "tacticalCoaching"
  | "technical"
  | "workingWithYoungsters"
  | "adaptability"
  | "determination"
  | "authority"
  | "manManagement"
  | "motivating"
  | "judgingCurrentAbility"
  | "judgingPotentialAbility"
  | "judgingStaffAbility"
  | "negotiating"
  | "tacticalKnowledge"
  | "analysingData"
  | "physiotherapy"
  | "sportsScience";

export type StaffAttributeGroup = "Coaching" | "Mental" | "Knowledge" | "Medical";

export interface StaffAttributeDef {
  key: StaffAttributeKey;
  /** Column abbreviation as the Staff view prints it. */
  abbr: string;
  label: string;
  group: StaffAttributeGroup;
  /** Normalised headers (lowercase, letters and digits only) that map to this attribute. */
  headers: string[];
}

/** Display order: grouped like FM's staff profile. */
export const STAFF_ATTRIBUTES: StaffAttributeDef[] = [
  { key: "attacking", abbr: "Att", label: "Attacking", group: "Coaching", headers: ["att", "attacking"] },
  { key: "defending", abbr: "Def", label: "Defending", group: "Coaching", headers: ["def", "defending"] },
  { key: "fitness", abbr: "Fit", label: "Fitness", group: "Coaching", headers: ["fit", "fitness"] },
  {
    key: "goalkeeping",
    abbr: "GK",
    label: "Goalkeeping",
    group: "Coaching",
    headers: ["gk", "goalkeeping", "goalkeepers", "goalkeeper"],
  },
  { key: "possession", abbr: "Pos", label: "Possession", group: "Coaching", headers: ["pos", "possession"] },
  { key: "setPieces", abbr: "Set", label: "Set pieces", group: "Coaching", headers: ["set", "setpieces"] },
  { key: "tacticalCoaching", abbr: "TCo", label: "Tactical", group: "Coaching", headers: ["tco", "tactical"] },
  { key: "technical", abbr: "Tec", label: "Technical", group: "Coaching", headers: ["tec", "technical"] },
  {
    key: "workingWithYoungsters",
    abbr: "Yng",
    label: "Working with youngsters",
    group: "Coaching",
    headers: ["yng", "workingwithyoungsters", "youngsters"],
  },
  { key: "adaptability", abbr: "Ada", label: "Adaptability", group: "Mental", headers: ["ada", "adaptability"] },
  {
    key: "determination",
    abbr: "Det",
    label: "Determination",
    group: "Mental",
    headers: ["det", "determination"],
  },
  {
    key: "authority",
    abbr: "Auth",
    label: "Authority (discipline)",
    group: "Mental",
    headers: ["auth", "authority", "levelofdiscipline", "discipline", "dis"],
  },
  {
    key: "manManagement",
    abbr: "Mgm",
    label: "People management",
    group: "Mental",
    headers: ["mgm", "manmanagement", "peoplemanagement", "mm"],
  },
  { key: "motivating", abbr: "Mot", label: "Motivating", group: "Mental", headers: ["mot", "motivating"] },
  {
    key: "judgingCurrentAbility",
    abbr: "JCA",
    label: "Judging current ability",
    group: "Knowledge",
    headers: ["jca", "judgingcurrentability", "judgingplayerability"],
  },
  {
    key: "judgingPotentialAbility",
    abbr: "JPA",
    label: "Judging potential ability",
    group: "Knowledge",
    headers: ["jpa", "judgingpotentialability", "judgingplayerpotential", "jpp"],
  },
  {
    key: "judgingStaffAbility",
    abbr: "Jud SA",
    label: "Judging staff ability",
    group: "Knowledge",
    headers: ["judsa", "jsa", "judgingstaffability"],
  },
  { key: "negotiating", abbr: "Neg", label: "Negotiating", group: "Knowledge", headers: ["neg", "negotiating"] },
  {
    key: "tacticalKnowledge",
    abbr: "Tct",
    label: "Tactical knowledge",
    group: "Knowledge",
    headers: ["tct", "tacticalknowledge"],
  },
  {
    key: "analysingData",
    abbr: "Ana D",
    label: "Analysing data",
    group: "Knowledge",
    headers: ["anad", "analysingdata", "analyzingdata", "dat"],
  },
  {
    key: "physiotherapy",
    abbr: "Phy",
    label: "Physiotherapy",
    group: "Medical",
    headers: ["phy", "physiotherapy", "physio"],
  },
  {
    key: "sportsScience",
    abbr: "SpS",
    label: "Sports science",
    group: "Medical",
    headers: ["sps", "sportsscience"],
  },
];

export const STAFF_ATTRIBUTE_GROUPS: StaffAttributeGroup[] = ["Coaching", "Mental", "Knowledge", "Medical"];

export const STAFF_ATTRIBUTE_BY_KEY: Record<StaffAttributeKey, StaffAttributeDef> = Object.fromEntries(
  STAFF_ATTRIBUTES.map((a) => [a.key, a]),
) as Record<StaffAttributeKey, StaffAttributeDef>;

export type StaffRatingWord =
  | "Unsuited"
  | "Reasonable"
  | "Competent"
  | "Average"
  | "Good"
  | "Very Good"
  | "Outstanding"
  | "Elite";

export interface StaffRatingBand {
  word: StaffRatingWord;
  /** Compact form for dense table cells. */
  short: string;
  min: number;
  max: number;
  /** Midpoint of the range, used for scoring. */
  value: number;
}

/** Worst first. */
export const STAFF_RATING_BANDS: StaffRatingBand[] = [
  { word: "Unsuited", short: "Uns", min: 1, max: 3, value: 2 },
  { word: "Reasonable", short: "Rea", min: 4, max: 6, value: 5 },
  { word: "Competent", short: "Com", min: 7, max: 9, value: 8 },
  { word: "Average", short: "Avg", min: 10, max: 11, value: 10.5 },
  { word: "Good", short: "Good", min: 12, max: 14, value: 13 },
  { word: "Very Good", short: "VG", min: 15, max: 17, value: 16 },
  { word: "Outstanding", short: "Outs", min: 18, max: 19, value: 18.5 },
  { word: "Elite", short: "Elite", min: 20, max: 20, value: 20 },
];

/** A parsed staff attribute: the band it falls in and the 1–20 value used for scoring. */
export interface StaffRating {
  band: StaffRatingBand;
  /** Exact value when the export had a number; the band midpoint when it had a word. */
  value: number;
  /** True when the export gave an exact 1–20 number rather than a word. */
  exact: boolean;
}

const BAND_BY_WORD = new Map(STAFF_RATING_BANDS.map((b) => [b.word.toLowerCase().replace(/\s+/g, ""), b]));

/** Band a 1–20 value falls in (values are rounded first). */
export function bandForValue(value: number): StaffRatingBand {
  const v = Math.min(20, Math.max(1, Math.round(value)));
  return STAFF_RATING_BANDS.find((b) => v >= b.min && v <= b.max) ?? STAFF_RATING_BANDS[0];
}

/** Parse an FM26 word ("Very Good") or a 1–20 number (older FMs). Null when blank or unknown ("-"). */
export function parseStaffRating(raw: string | undefined): StaffRating | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (!t) return null;
  const band = BAND_BY_WORD.get(t.toLowerCase().replace(/\s+/g, ""));
  if (band) return { band, value: band.value, exact: false };
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= 20) return { band: bandForValue(n), value: n, exact: true };
  }
  return null;
}

/** "Good (12–14)" / "15 (Very Good)" for tooltips. */
export function describeRating(r: StaffRating): string {
  if (r.exact) return `${r.value} (${r.band.word})`;
  const range = r.band.min === r.band.max ? `${r.band.min}` : `${r.band.min}–${r.band.max}`;
  return `${r.band.word} (${range})`;
}
