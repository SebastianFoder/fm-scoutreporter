import { csvLines, detectDelimiter, splitCsvLine } from "@/lib/parser/csv-utils";
import {
  STAFF_ATTRIBUTES,
  parseStaffRating,
  type StaffAttributeKey,
  type StaffRating,
} from "./staff-attributes";

export interface StaffMember {
  uniqueId: string;
  name: string;
  /** FM's status column (FrA = free agent, Wnt = wanted, ...); empty when none. */
  status: string;
  preferredJob: string;
  /** Empty for free agents. */
  club: string;
  personality: string;
  euNational: boolean;
  age: number | null;
  nationality: string;
  /** Null when the export left the attribute out or hid it. */
  attributes: Record<StaffAttributeKey, StaffRating | null>;
}

export interface StaffParseResult {
  staff: StaffMember[];
  /** Attributes the header named. */
  columns: StaffAttributeKey[];
  /** False when the header has (almost) no staff-only columns, e.g. a player export. */
  isStaffExport: boolean;
  /** Rows dropped because the same person (by UID) was already imported. */
  duplicates: number;
}

const META_HEADERS: Record<string, string[]> = {
  uniqueId: ["uid", "uniqueid", "id"],
  name: ["person", "name", "staff", "player"],
  status: ["status", "inf"],
  preferredJob: ["preferredjob", "job", "role"],
  club: ["club"],
  personality: ["personality"],
  euNational: ["eunational", "eu"],
  age: ["age"],
  nationality: ["nationality", "nat"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse a Staff view CSV export (FM26 words or 1–20 numbers, `,` or `;` delimited). */
export function parseStaffCsv(csv: string): StaffParseResult {
  const lines = csvLines(csv);
  if (lines.length === 0) return { staff: [], columns: [], isStaffExport: false, duplicates: 0 };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const index = new Map<string, number>();
  headers.forEach((h, i) => {
    if (!index.has(h)) index.set(h, i);
  });
  const find = (aliases: string[]): number | undefined => {
    for (const a of aliases) {
      const i = index.get(a);
      if (i !== undefined) return i;
    }
    return undefined;
  };

  const meta = Object.fromEntries(
    Object.entries(META_HEADERS).map(([k, aliases]) => [k, find(aliases)]),
  ) as Record<keyof typeof META_HEADERS, number | undefined>;
  const attrIndex = STAFF_ATTRIBUTES.map((a) => [a.key, find(a.headers)] as const);
  const columns = attrIndex.filter(([, i]) => i !== undefined).map(([k]) => k);
  // Player exports share Determination; a staff export names several staff-only attributes.
  const isStaffExport = columns.filter((k) => k !== "determination").length >= 3;

  const seen = new Set<string>();
  const staff: StaffMember[] = [];
  let duplicates = 0;

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line, delimiter);
    const get = (i: number | undefined) => (i === undefined ? "" : (cols[i] ?? "").trim());

    const name = get(meta.name);
    if (!name) continue;
    const uniqueId = get(meta.uniqueId) || `${name}|${get(meta.club)}`;
    if (seen.has(uniqueId)) {
      duplicates += 1;
      continue;
    }
    seen.add(uniqueId);

    const attributes = {} as Record<StaffAttributeKey, StaffRating | null>;
    for (const [key, i] of attrIndex) attributes[key] = i === undefined ? null : parseStaffRating(cols[i]);

    const ageRaw = Number(get(meta.age));
    const eu = get(meta.euNational).toLowerCase();

    staff.push({
      uniqueId,
      name,
      status: get(meta.status),
      preferredJob: get(meta.preferredJob),
      club: get(meta.club),
      personality: get(meta.personality),
      euNational: eu === "yes" || eu === "true",
      age: Number.isFinite(ageRaw) && ageRaw > 0 ? ageRaw : null,
      nationality: get(meta.nationality),
      attributes,
    });
  }

  return { staff, columns, isStaffExport, duplicates };
}

/** No club, or FM's FrA (free agent) status. */
export function isFreeAgent(s: StaffMember): boolean {
  return !s.club || /\bfra\b/i.test(s.status);
}
