/**
 * Imports that did not come from a CSV: already-parsed records, for example from a desktop scan.
 * They are stored in the import store (IndexedDB) next to, and under the same keys as, CSV imports.
 */
import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";
import type { StaffMember } from "@scoutreporter/core/staff/staff-parser";
import type { StaffAttributeKey } from "@scoutreporter/core/staff/staff-attributes";

/** Where a records import came from, for labels ("Scan of 14 Aug 2027"). */
export interface ImportSource {
  kind: "scan";
  label: string;
  snapshotId?: string;
  scannedAt?: string;
  gameDate?: string | null;
  /** How many the whole scan had, when only part of it was loaded (see LoadScope). */
  total?: number;
  /** Size of FM's search result, when only people from it (plus your club) were loaded. */
  search?: number;
}

export interface StoredPlayerRecords {
  kind: "records";
  version: 1;
  source: ImportSource;
  players: PlayerAttributes[];
}

export interface StoredStaffRecords {
  kind: "records";
  version: 1;
  source: ImportSource;
  staff: StaffMember[];
  columns: StaffAttributeKey[];
}

function isRecords(value: unknown): value is { kind: "records"; version: number; source: ImportSource } {
  const v = value as { kind?: unknown; version?: unknown; source?: unknown } | null;
  return !!v && typeof v === "object" && v.kind === "records" && v.version === 1 && typeof v.source === "object";
}

export function isStoredPlayerRecords(value: unknown): value is StoredPlayerRecords {
  return isRecords(value) && Array.isArray((value as Partial<StoredPlayerRecords>).players);
}

export function isStoredStaffRecords(value: unknown): value is StoredStaffRecords {
  return (
    isRecords(value) &&
    Array.isArray((value as Partial<StoredStaffRecords>).staff) &&
    Array.isArray((value as Partial<StoredStaffRecords>).columns)
  );
}
