"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { parsePlayersCsv } from "@/lib/parser/csv-parser";
import { groupPlayerAttributes } from "@/lib/parser/attribute-grouper";
import { computeDatasetPotentials, type CaModelSet } from "@/lib/fm27/potential";
import type { PlayerWithGroups } from "@/data/players-store";

export type { PlayerWithGroups };

type PlayersDataState = {
  csvText: string | null;
  players: PlayerWithGroups[];
  /** CA model used for potential projections; null when the import has no CA/PA (v1 view). */
  caModels: CaModelSet | null;
};

type PlayersDataContextValue = {
  state: PlayersDataState;
  setState: Dispatch<SetStateAction<PlayersDataState>>;
  /** Returns false if the CSV could not be persisted (e.g. storage quota). In-memory state is still updated. */
  setCsvText: (csvText: string) => boolean;
  clear: () => void;
};

const STORAGE_KEY = "importedPlayersCsv";
const LEGACY_SESSION_KEY = "importedPlayersCsv";

const PlayersDataContext = createContext<PlayersDataContextValue | null>(null);

function parseAndGroup(csvText: string): Omit<PlayersDataState, "csvText"> {
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

function readStoredCsv(): string | null {
  try {
    let stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const legacy = window.sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (legacy) {
        window.localStorage.setItem(STORAGE_KEY, legacy);
        window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
        stored = legacy;
      }
    }
    return stored;
  } catch {
    return null;
  }
}

export function PlayersDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PlayersDataState>(EMPTY);

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    try {
      const stored = readStoredCsv();
      if (!stored) return;
      setState({ csvText: stored, ...parseAndGroup(stored) });
    } catch {
      // ignore
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue) {
        try {
          setState({ csvText: e.newValue, ...parseAndGroup(e.newValue) });
        } catch {
          setState(EMPTY);
        }
      } else {
        setState(EMPTY);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setCsvText = useCallback(
    (csvText: string) => {
      setState({ csvText, ...parseAndGroup(csvText) });
      let persisted = true;
      try {
        window.localStorage.setItem(STORAGE_KEY, csvText);
        window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
      } catch {
        persisted = false;
      }
      return persisted;
    },
    [],
  );

  const clear = useCallback(() => {
    setState(EMPTY);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

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
