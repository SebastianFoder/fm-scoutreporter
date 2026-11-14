"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AttributeKey } from "@scoutreporter/core/types/weights";
import { Button } from "./Button";

export interface HighlightProfile {
  id: string;
  name: string;
  highlighted: AttributeKey[];
}

type StoredConfig = {
  activeId: string;
  profiles: HighlightProfile[];
};

type HighlightContextValue = {
  state: StoredConfig;
  setState: Dispatch<SetStateAction<StoredConfig>>;
};

const STORAGE_KEY = "highlightProfiles";

const DEFAULT_PROFILE: HighlightProfile = {
  id: "default",
  name: "Default",
  highlighted: ["finishing", "offTheBall", "pace"],
};

const HighlightContext = createContext<HighlightContextValue | null>(null);

function loadFromStorage(): StoredConfig {
  if (typeof window === "undefined") {
    return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
    const parsed = JSON.parse(raw) as StoredConfig;
    if (!parsed.profiles?.length) {
      return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
    }
    return parsed;
  } catch {
    return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
  }
}

function saveToStorage(config: StoredConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function useHighlightContext(): HighlightContextValue {
  const ctx = useContext(HighlightContext);
  if (!ctx) {
    return {
      state: { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] },
      setState: () => {},
    };
  }
  return ctx;
}

export function HighlightedAttributesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<StoredConfig>({
    activeId: DEFAULT_PROFILE.id,
    profiles: [DEFAULT_PROFILE],
  });

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    setState(loadFromStorage());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  return (
    <HighlightContext.Provider value={{ state, setState }}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlightedAttributes(): AttributeKey[] {
  const { state } = useHighlightContext();
  const active =
    state.profiles.find((p) => p.id === state.activeId) ??
    state.profiles[0] ??
    DEFAULT_PROFILE;
  return active.highlighted;
}

const GOALKEEPING_KEYS: AttributeKey[] = [
  "aerialReach",
  "commandOfArea",
  "communication",
  "eccentricity",
  "handling",
  "kicking",
  "oneOnOnes",
  "punching",
  "reflexes",
  "rushingOutTendency",
  "throwing",
];

const TECHNICAL_KEYS: AttributeKey[] = [
  "corners",
  "crossing",
  "dribbling",
  "finishing",
  "firstTouch",
  "freeKickTaking",
  "penaltyTaking",
  "heading",
  "longShots",
  "longThrows",
  "marking",
  "passing",
  "tackling",
  "technique",
];

const MENTAL_KEYS: AttributeKey[] = [
  "aggression",
  "anticipation",
  "bravery",
  "composure",
  "concentration",
  "decisions",
  "determination",
  "flair",
  "leadership",
  "offTheBall",
  "positioning",
  "teamWork",
  "vision",
  "workRate",
];

const PHYSICAL_KEYS: AttributeKey[] = [
  "acceleration",
  "agility",
  "balance",
  "jumpingReach",
  "naturalFitness",
  "pace",
  "stamina",
  "strength",
];

function titleCaseFromCamel(key: string) {
  const withSpaces = key.replace(/([a-z])([A-Z])/g, "$1 $2");
  return withSpaces
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

/** The Columns tab in Settings: which attributes the player list and compare show as columns. */
export function HighlightSettings() {
  const { state, setState } = useHighlightContext();
  const { activeId, profiles } = state;

  const active =
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? DEFAULT_PROFILE;

  const updateActive = (updater: (p: HighlightProfile) => HighlightProfile) => {
    setState((prev) => ({
      activeId: prev.activeId,
      profiles: prev.profiles.map((p) => (p.id === active.id ? updater(p) : p)),
    }));
  };

  const createNew = () => {
    const id = `profile-${Date.now()}`;
    const next: HighlightProfile = {
      id,
      name: "New Profile",
      highlighted: [],
    };
    setState((prev) => ({
      activeId: id,
      profiles: [...prev.profiles, next],
    }));
  };

  const duplicate = () => {
    const id = `profile-${Date.now()}`;
    const next: HighlightProfile = {
      ...active,
      id,
      name: `${active.name} Copy`,
      highlighted: [...active.highlighted],
    };
    setState((prev) => ({ activeId: id, profiles: [...prev.profiles, next] }));
  };

  const remove = () => {
    if (profiles.length <= 1) return;
    const remaining = profiles.filter((p) => p.id !== active.id);
    setState({ activeId: remaining[0].id, profiles: remaining });
  };

  const toggleKey = (key: AttributeKey) => {
    updateActive((p) => {
      const exists = p.highlighted.includes(key);
      const highlighted = exists
        ? p.highlighted.filter((k) => k !== key)
        : [...p.highlighted, key];
      return { ...p, highlighted };
    });
  };

  const renderGroup = (title: string, keys: AttributeKey[]) => {
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    const used = sorted.filter((k) => active.highlighted.includes(k)).length;
    return (
      <section>
        <h3 className="section-title sticky top-0 z-[1] -mx-5 flex items-baseline justify-between border-y border-line bg-paper px-5 py-1.5">
          {title}
          <span className="text-[12px] font-normal text-muted">{used} shown</span>
        </h3>
        <div className="grid grid-cols-2 gap-x-3 py-1.5">
          {sorted.map((k) => {
            const checked = active.highlighted.includes(k);
            return (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-ink/5"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 cursor-pointer"
                  checked={checked}
                  onChange={() => toggleKey(k)}
                />
                <span className={`truncate text-sm ${checked ? "font-semibold" : "text-muted"}`}>
                  {titleCaseFromCamel(k)}
                </span>
              </label>
            );
          })}
        </div>
      </section>
    );
  };

  return (
      <div className="space-y-4">
      <p className="text-[13px] text-muted">The attributes the player list and compare show as columns. Save different sets as profiles.</p>

        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Profile
            <select
              className="field h-9 w-full pl-2.5 text-sm font-semibold text-ink"
              value={active.id}
              onChange={(e) =>
                setState((prev) => ({ ...prev, activeId: e.target.value }))
              }
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Name
            <input
              type="text"
              className="field h-9 w-full px-2.5 text-sm text-ink"
              value={active.name}
              onChange={(e) =>
                updateActive((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="Profile name"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button color="alt" variant="outline" size="sm" onClick={createNew}>
              Create New
            </Button>
            <Button color="alt" variant="outline" size="sm" onClick={duplicate}>
              Duplicate
            </Button>
            <Button
              color="red"
              variant="outline"
              size="sm"
              onClick={remove}
              disabled={profiles.length <= 1}
            >
              Delete
            </Button>
          </div>
        </div>

        <div>
          {renderGroup("Technical", TECHNICAL_KEYS)}
          {renderGroup("Mental", MENTAL_KEYS)}
          {renderGroup("Physical", PHYSICAL_KEYS)}
          {renderGroup("Goalkeeping", GOALKEEPING_KEYS)}
        </div>
      </div>
  );
}
