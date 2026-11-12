"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { parsePlayersCsv } from "@scoutreporter/core/parser/csv-parser";
import { groupPlayerAttributes } from "@scoutreporter/core/parser/attribute-grouper";
import { computeDatasetPotentials, type CaModelSet } from "@scoutreporter/core/fm27/potential";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { useStoredImport } from "./useStoredImport";

export type { PlayerWithGroups };

type PlayersDataState = {
  csvText: string | null;
  players: PlayerWithGroups[];
  /** CA model used for potential projections; null when the import has no CA/PA (Standard view). */
  caModels: CaModelSet | null;
};

type PlayersDataContextValue = {
  state: PlayersDataState;
  setState: Dispatch<SetStateAction<PlayersDataState>>;
  /**
   * Import a CSV. Resolves false if it could not be persisted (storage blocked or full); the
   * in-memory state is updated either way.
   */
  setCsvText: (csvText: string) => Promise<boolean>;
  clear: () => void;
};

/** IndexedDB key of the player import (also its old localStorage key, migrated on first load). */
export const PLAYERS_STORAGE_KEY = "importedPlayersCsv";
const STORAGE_KEY = PLAYERS_STORAGE_KEY;
/** The oldest imports were kept in sessionStorage under this key. */
const LEGACY_SESSION_KEY = "importedPlayersCsv";

const PlayersDataContext = createContext<PlayersDataContextValue | null>(null);

/** Parse a CSV export into the grouped dataset the app works with. */
export function parseAndGroup(csvText: string): Omit<PlayersDataState, "csvText"> {
  const parsed = parsePlayersCsv(csvText);
  const potentials = computeDatasetPotentials(parsed);
  return {
    players: parsed.map((p) => ({
      raw: p,
      grouped: groupPlayerAttributes(p),
      potential: potentials.byId.get(p.uniqueId) ?? null,
    })),
    caModels: potentials.available ? potentials.models : null,
  };
}

const EMPTY: PlayersDataState = { csvText: null, players: [], caModels: null };

export function PlayersDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PlayersDataState>(EMPTY);

  const { save, remove } = useStoredImport(
    STORAGE_KEY,
    (stored) => {
      if (!stored) {
        setState(EMPTY);
        return;
      }
      try {
        setState({ csvText: stored, ...parseAndGroup(stored) });
      } catch {
        setState(EMPTY);
      }
    },
    LEGACY_SESSION_KEY,
  );

  const setCsvText = useCallback(
    (csvText: string) => {
      setState({ csvText, ...parseAndGroup(csvText) });
      return save(csvText);
    },
    [save],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
    void remove();
  }, [remove]);

  const value = useMemo(
    () => ({ state, setState, setCsvText, clear }),
    [state, setCsvText, clear],
  );

  return (
    <PlayersDataContext.Provider value={value}>
      {children}
    </PlayersDataContext.Provider>
  );
}

export function usePlayersData() {
  const ctx = useContext(PlayersDataContext);
  if (!ctx) {
    throw new Error("usePlayersData must be used within PlayersDataProvider");
  }
  return ctx;
}
