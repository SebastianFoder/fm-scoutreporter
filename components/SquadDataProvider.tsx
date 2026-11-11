"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseAndGroup, type PlayerWithGroups } from "./PlayersDataProvider";
import type { CaModelSet } from "@/lib/fm27/potential";
import { parseSquadFields, type SquadColumns, type SquadFields } from "@/lib/squad/squad-fields";

type SquadDataState = {
  csvText: string | null;
  players: PlayerWithGroups[];
  /** Set when the export has CA and PA (Hidden Attributes view). */
  caModels: CaModelSet | null;
  /** Squad-only columns (team sheet, squad status, injuries, coach stars…) by Unique ID. */
  fields: Map<string, SquadFields>;
  /** Which squad-only columns the export had (none for a plain player export). */
  columns: SquadColumns | null;
};

export type SquadImportResult = { ok: true; persisted: boolean } | { ok: false; error: string };

type SquadDataContextValue = {
  state: SquadDataState;
  /** Parse and store a squad export (Standard or Hidden Attributes view). */
  importCsv: (csvText: string) => SquadImportResult;
  clear: () => void;
};

/** Separate from the player (scouting) import, so a squad can be checked against scouting targets. */
export const SQUAD_STORAGE_KEY = "importedSquadCsv";

const EMPTY: SquadDataState = { csvText: null, players: [], caModels: null, fields: new Map(), columns: null };

const SquadDataContext = createContext<SquadDataContextValue | null>(null);

function stateFor(csvText: string): SquadDataState | null {
  const parsed = parseAndGroup(csvText);
  if (!parsed.players.some((p) => p.raw.position.trim() !== "")) return null;
  const squad = parseSquadFields(csvText);
  return { csvText, ...parsed, fields: squad.byId, columns: squad.columns };
}

export function SquadDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SquadDataState>(EMPTY);

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SQUAD_STORAGE_KEY);
      const next = stored ? stateFor(stored) : null;
      if (next) setState(next);
    } catch {
      // storage blocked or corrupt: start empty
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SQUAD_STORAGE_KEY) return;
      try {
        setState((e.newValue && stateFor(e.newValue)) || EMPTY);
      } catch {
        setState(EMPTY);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const importCsv = useCallback((csvText: string): SquadImportResult => {
    const next = stateFor(csvText);
    if (!next) {
      return {
        ok: false,
        error:
          "No players with positions found in this file. Export your squad with the Scout Reporter Standard or Hidden Attributes view.",
      };
    }
    setState(next);
    let persisted = true;
    try {
      window.localStorage.setItem(SQUAD_STORAGE_KEY, csvText);
    } catch {
      persisted = false;
    }
    return { ok: true, persisted };
  }, []);

  const clear = useCallback(() => {
    setState(EMPTY);
    try {
      window.localStorage.removeItem(SQUAD_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ state, importCsv, clear }), [state, importCsv, clear]);

  return <SquadDataContext.Provider value={value}>{children}</SquadDataContext.Provider>;
}

export function useSquadData() {
  const ctx = useContext(SquadDataContext);
  if (!ctx) throw new Error("useSquadData must be used within SquadDataProvider");
  return ctx;
}
