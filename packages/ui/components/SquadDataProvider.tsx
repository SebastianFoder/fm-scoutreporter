"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { parseAndGroup, type PlayerWithGroups } from "./PlayersDataProvider";
import { useStoredImport } from "./useStoredImport";
import type { CaModelSet } from "@scoutreporter/core/fm27/potential";
import { parseSquadFields, type SquadColumns, type SquadFields } from "@scoutreporter/core/squad/squad-fields";

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
  importCsv: (csvText: string) => Promise<SquadImportResult>;
  clear: () => void;
};

/**
 * Separate from the player (scouting) import, so a squad can be checked against scouting targets.
 * IndexedDB key (also its old localStorage key, migrated on first load).
 */
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

  const { save, remove } = useStoredImport(SQUAD_STORAGE_KEY, (stored) => {
    try {
      setState((stored && stateFor(stored)) || EMPTY);
    } catch {
      setState(EMPTY);
    }
  });

  const importCsv = useCallback(
    async (csvText: string): Promise<SquadImportResult> => {
      const next = stateFor(csvText);
      if (!next) {
        return {
          ok: false,
          error:
            "No players with positions found in this file. Export your squad with the Scout Reporter Standard or Hidden Attributes view.",
        };
      }
      setState(next);
      return { ok: true, persisted: await save(csvText) };
    },
    [save],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
    void remove();
  }, [remove]);

  const value = useMemo(() => ({ state, importCsv, clear }), [state, importCsv, clear]);

  return <SquadDataContext.Provider value={value}>{children}</SquadDataContext.Provider>;
}

export function useSquadData() {
  const ctx = useContext(SquadDataContext);
  if (!ctx) throw new Error("useSquadData must be used within SquadDataProvider");
  return ctx;
}
