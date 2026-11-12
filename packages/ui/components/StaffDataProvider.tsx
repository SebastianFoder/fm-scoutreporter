"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { parseStaffCsv, type StaffMember } from "@scoutreporter/core/staff/staff-parser";
import type { StaffAttributeKey } from "@scoutreporter/core/staff/staff-attributes";
import {
  isStoredStaffRecords,
  type ImportSource,
  type StoredStaffRecords,
} from "@scoutreporter/core/storage/stored-records";
import { useStoredImport } from "./useStoredImport";

type StaffDataState = {
  csvText: string | null;
  /** Set when the staff came from records (a desktop scan) instead of a CSV. */
  source: ImportSource | null;
  staff: StaffMember[];
  /** Attributes the import had columns for. */
  columns: StaffAttributeKey[];
};

export type StaffImportResult =
  | { ok: true; persisted: boolean; duplicates: number }
  | { ok: false; error: string };

type StaffDataContextValue = {
  state: StaffDataState;
  /** Parse and store a Staff view export. Rejects files with no staff columns (e.g. a player export). */
  importCsv: (csvText: string) => Promise<StaffImportResult>;
  /** Import already-parsed staff (a desktop scan). Resolves false if they could not be persisted. */
  importRecords: (staff: StaffMember[], columns: StaffAttributeKey[], source: ImportSource) => Promise<boolean>;
  clear: () => void;
};

/** Separate from the player import, so both can be loaded at once. IndexedDB key (also its old localStorage key). */
export const STAFF_STORAGE_KEY = "importedStaffCsv";

const EMPTY: StaffDataState = { csvText: null, source: null, staff: [], columns: [] };

const StaffDataContext = createContext<StaffDataContextValue | null>(null);

function stateFor(csvText: string): StaffDataState | null {
  const parsed = parseStaffCsv(csvText);
  if (!parsed.isStaffExport) return null;
  return { csvText, source: null, staff: parsed.staff, columns: parsed.columns };
}

function stateForStored(stored: unknown): StaffDataState | null {
  if (typeof stored === "string") return stateFor(stored);
  if (isStoredStaffRecords(stored)) {
    return { csvText: null, source: stored.source, staff: stored.staff, columns: stored.columns };
  }
  return null;
}

export function StaffDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StaffDataState>(EMPTY);

  const { save, remove } = useStoredImport(STAFF_STORAGE_KEY, (stored) => {
    try {
      setState(stateForStored(stored) ?? EMPTY);
    } catch {
      setState(EMPTY);
    }
  });

  const importCsv = useCallback(
    async (csvText: string): Promise<StaffImportResult> => {
      const parsed = parseStaffCsv(csvText);
      if (!parsed.isStaffExport) {
        return {
          ok: false,
          error:
            "No staff attributes found in this file. Export it from a staff search with the Scout Reporter Staff view (player exports go in Attribute mode).",
        };
      }
      setState({ csvText, source: null, staff: parsed.staff, columns: parsed.columns });
      return { ok: true, persisted: await save(csvText), duplicates: parsed.duplicates };
    },
    [save],
  );

  const importRecords = useCallback(
    (staff: StaffMember[], columns: StaffAttributeKey[], source: ImportSource) => {
      setState({ csvText: null, source, staff, columns });
      const stored: StoredStaffRecords = { kind: "records", version: 1, source, staff, columns };
      return save(stored);
    },
    [save],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
    void remove();
  }, [remove]);

  const value = useMemo(
    () => ({ state, importCsv, importRecords, clear }),
    [state, importCsv, importRecords, clear],
  );

  return <StaffDataContext.Provider value={value}>{children}</StaffDataContext.Provider>;
}

export function useStaffData() {
  const ctx = useContext(StaffDataContext);
  if (!ctx) throw new Error("useStaffData must be used within StaffDataProvider");
  return ctx;
}
