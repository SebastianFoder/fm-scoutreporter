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
import type { PlayerAttributes } from "@scoutreporter/core/types/player-attributes";
import {
  isStoredPlayerRecords,
  type ImportSource,
  type StoredPlayerRecords,
} from "@scoutreporter/core/storage/stored-records";
import { useStoredImport } from "./useStoredImport";

export type { PlayerWithGroups };

type PlayersDataState = {
  csvText: string | null;
  /** Set when the import came from records (a desktop scan) instead of a CSV. */
  source: ImportSource | null;
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
  /** Import already-parsed records (a desktop scan). Resolves false if they could not be persisted. */
  importRecords: (players: PlayerAttributes[], source: ImportSource) => Promise<boolean>;
  clear: () => void;
};

/** IndexedDB key of the player import (also its old localStorage key, migrated on first load). */
export const PLAYERS_STORAGE_KEY = "importedPlayersCsv";
const STORAGE_KEY = PLAYERS_STORAGE_KEY;
/** The oldest imports were kept in sessionStorage under this key. */
const LEGACY_SESSION_KEY = "importedPlayersCsv";

const PlayersDataContext = createContext<PlayersDataContextValue | null>(null);

/** Parse a CSV export into the grouped dataset the app works with. */
export function parseAndGroup(csvText: string): Omit<PlayersDataState, "csvText" | "source"> {
  return groupRecords(parsePlayersCsv(csvText));
}

/** Group parsed player records (from a CSV or a desktop scan) into the dataset the app works with. */
export function groupRecords(parsed: PlayerAttributes[]): Omit<PlayersDataState, "csvText" | "source"> {
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

const EMPTY: PlayersDataState = { csvText: null, source: null, players: [], caModels: null };

/** State for a stored import: CSV text or a records object. Null when it is neither. */
function stateForStored(stored: unknown): PlayersDataState | null {
  if (typeof stored === "string") return { csvText: stored, source: null, ...parseAndGroup(stored) };
  if (isStoredPlayerRecords(stored)) return { csvText: null, source: stored.source, ...groupRecords(stored.players) };
  return null;
}

export function PlayersDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PlayersDataState>(EMPTY);

  const { save, remove } = useStoredImport(
    STORAGE_KEY,
    (stored) => {
      try {
        setState(stateForStored(stored) ?? EMPTY);
      } catch {
        setState(EMPTY);
      }
    },
    LEGACY_SESSION_KEY,
  );

  const setCsvText = useCallback(
    (csvText: string) => {
      setState({ csvText, source: null, ...parseAndGroup(csvText) });
      return save(csvText);
    },
    [save],
  );

  const importRecords = useCallback(
    (players: PlayerAttributes[], source: ImportSource) => {
      setState({ csvText: null, source, ...groupRecords(players) });
      const stored: StoredPlayerRecords = { kind: "records", version: 1, source, players };
      return save(stored);
    },
    [save],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
    void remove();
  }, [remove]);

  const value = useMemo(
    () => ({ state, setState, setCsvText, importRecords, clear }),
    [state, setCsvText, importRecords, clear],
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
