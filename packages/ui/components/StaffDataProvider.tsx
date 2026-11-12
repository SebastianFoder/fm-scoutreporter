"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseStaffCsv, type StaffMember } from "@scoutreporter/core/staff/staff-parser";
import type { StaffAttributeKey } from "@scoutreporter/core/staff/staff-attributes";

type StaffDataState = {
  csvText: string | null;
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
  importCsv: (csvText: string) => StaffImportResult;
  clear: () => void;
};

/** Separate from the player import, so both can be loaded at once. */
export const STAFF_STORAGE_KEY = "importedStaffCsv";

const EMPTY: StaffDataState = { csvText: null, staff: [], columns: [] };

const StaffDataContext = createContext<StaffDataContextValue | null>(null);

function stateFor(csvText: string): StaffDataState | null {
  const parsed = parseStaffCsv(csvText);
  if (!parsed.isStaffExport) return null;
  return { csvText, staff: parsed.staff, columns: parsed.columns };
}

export function StaffDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StaffDataState>(EMPTY);

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STAFF_STORAGE_KEY);
      const next = stored ? stateFor(stored) : null;
      if (next) setState(next);
    } catch {
      // storage blocked or corrupt: start empty
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STAFF_STORAGE_KEY) return;
      setState((e.newValue && stateFor(e.newValue)) || EMPTY);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const importCsv = useCallback((csvText: string): StaffImportResult => {
    const parsed = parseStaffCsv(csvText);
    if (!parsed.isStaffExport) {
      return {
        ok: false,
        error:
          "No staff attributes found in this file. Export it from a staff search with the Scout Reporter Staff view (player exports go in Attribute mode).",
      };
    }
    setState({ csvText, staff: parsed.staff, columns: parsed.columns });
    let persisted = true;
    try {
      window.localStorage.setItem(STAFF_STORAGE_KEY, csvText);
    } catch {
      persisted = false;
    }
    return { ok: true, persisted, duplicates: parsed.duplicates };
  }, []);

  const clear = useCallback(() => {
    setState(EMPTY);
    try {
      window.localStorage.removeItem(STAFF_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ state, importCsv, clear }), [state, importCsv, clear]);

  return <StaffDataContext.Provider value={value}>{children}</StaffDataContext.Provider>;
}

export function useStaffData() {
  const ctx = useContext(StaffDataContext);
  if (!ctx) throw new Error("useStaffData must be used within StaffDataProvider");
  return ctx;
}
