"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  AttributeKey,
  AttributeWeights,
  WeightEmphasis,
  WeightProfile,
} from "@/types/weights";
import { Modal } from "./Modal";
import { Button } from "./Button";
import {
  ALL_ATTRIBUTE_KEYS as ALL_KEYS,
  GOALKEEPING_KEYS,
  MENTAL_KEYS,
  PHYSICAL_KEYS,
  TECHNICAL_KEYS,
} from "@/lib/attribute-keys";
import { fm27BenchmarkProfiles } from "@/lib/fm27/benchmarks";
import { LEGACY_EMPHASIS } from "@/lib/scoring";

const STORAGE_KEY = "weightProfiles";

/** Upper bound for per-attribute weight inputs and stored values (wider ratio vs min 0). */
const WEIGHT_MAX = 20;

const DEFAULT_PROFILE: WeightProfile = {
  id: "default",
  name: "Default",
  weights: {},
  emphasis: 1,
};

/** Bump to seed newly added benchmark profiles into existing users' saved profiles once. */
const SEED_VERSION = 1;
const FIRST_RUN_ACTIVE_ID = "fm27-10";

type StoredConfig = {
  activeId: string;
  profiles: WeightProfile[];
  seeded?: number;
};

type WeightContextValue = {
  state: StoredConfig;
  setState: Dispatch<SetStateAction<StoredConfig>>;
};

const WeightContext = createContext<WeightContextValue | null>(null);

function initialConfig(): StoredConfig {
  return {
    activeId: FIRST_RUN_ACTIVE_ID,
    profiles: [DEFAULT_PROFILE, ...fm27BenchmarkProfiles()].map(withNormalizedWeights),
    seeded: SEED_VERSION,
  };
}

/** Add benchmark profiles the user hasn't had yet (deleted ones stay deleted after the first seed). */
function seedBenchmarks(config: StoredConfig): StoredConfig {
  if ((config.seeded ?? 0) >= SEED_VERSION) return config;
  const ids = new Set(config.profiles.map((p) => p.id));
  const missing = fm27BenchmarkProfiles()
    .filter((p) => !ids.has(p.id))
    .map(withNormalizedWeights);
  return { ...config, profiles: [...config.profiles, ...missing], seeded: SEED_VERSION };
}

function loadFromStorage(): StoredConfig {
  if (typeof window === "undefined") return initialConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialConfig();
    const parsed = JSON.parse(raw) as StoredConfig;
    if (!parsed.profiles?.length) return initialConfig();
    return seedBenchmarks({
      activeId: parsed.activeId ?? DEFAULT_PROFILE.id,
      profiles: parsed.profiles.map(withNormalizedWeights),
      seeded: parsed.seeded,
    });
  } catch {
    return initialConfig();
  }
}

function saveToStorage(config: StoredConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage full or blocked: keep the in-memory profiles
  }
}

function useWeightContext(): WeightContextValue {
  const ctx = useContext(WeightContext);
  if (!ctx) {
    return {
      state: initialConfig(),
      setState: () => {},
    };
  }
  return ctx;
}

export function WeightProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredConfig>(initialConfig);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    setState(loadFromStorage());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) saveToStorage(state);
  }, [state, hydrated]);

  return (
    <WeightContext.Provider value={{ state, setState }}>
      {children}
    </WeightContext.Provider>
  );
}

export function useActiveWeightProfile(): WeightProfile & { emphasis: WeightEmphasis } {
  const { state } = useWeightContext();
  const active =
    state.profiles.find((p) => p.id === state.activeId) ??
    state.profiles[0] ??
    withNormalizedWeights(DEFAULT_PROFILE);
  return { ...active, emphasis: active.emphasis ?? LEGACY_EMPHASIS };
}

/** Every saved weight profile (benchmark and custom), for screens that score with more than one. */
export function useWeightProfiles(): WeightProfile[] {
  return useWeightContext().state.profiles;
}

export function useActiveWeights(): AttributeWeights {
  return useActiveWeightProfile().weights;
}

function titleCaseFromCamel(key: string) {
  const withSpaces = key.replace(/([a-z])([A-Z])/g, "$1 $2");
  return withSpaces
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function safeNumber(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  return clampWeight(rounded);
}

export function WeightConfigModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, setState } = useWeightContext();
  const { activeId, profiles } = state;

  const active =
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? DEFAULT_PROFILE;

  const [json, setJson] = useState("");

  /* The panel only closes through onClose, so clearing here means it always reopens empty. */
  const close = () => {
    setJson("");
    onClose();
  };

  const updateActive = (updater: (p: WeightProfile) => WeightProfile) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === active.id ? updater(p) : p)),
    }));
  };

  const createNew = () => {
    const id = `profile-${Date.now()}`;
    const next: WeightProfile = {
      id,
      name: "New Profile",
      weights: defaultWeights(),
      emphasis: 1,
    };
    setState((prev) => ({
      ...prev,
      activeId: id,
      profiles: [...prev.profiles, next],
    }));
  };

  const duplicate = () => {
    const id = `profile-${Date.now()}`;
    const next: WeightProfile = {
      ...active,
      id,
      name: `${active.name} Copy`,
      weights: { ...active.weights },
      builtIn: undefined,
    };
    setState((prev) => ({ ...prev, activeId: id, profiles: [...prev.profiles, next] }));
  };

  const remove = () => {
    if (profiles.length <= 1) return;
    const remaining = profiles.filter((p) => p.id !== active.id);
    setState((prev) => ({ ...prev, activeId: remaining[0].id, profiles: remaining }));
  };

  const exportProfile = () => {
    setJson(JSON.stringify(active, null, 2));
  };

  const importProfile = () => {
    try {
      const parsed = JSON.parse(json) as WeightProfile;
      if (!parsed?.id || !parsed?.name || !parsed?.weights) {
        throw new Error("invalid");
      }
      const normalized = withNormalizedWeights(parsed);
      setState((prev) => {
        const exists = prev.profiles.some((p) => p.id === parsed.id);
        const nextProfiles = exists
          ? prev.profiles.map((p) => (p.id === parsed.id ? normalized : p))
          : [...prev.profiles, normalized];
        return { ...prev, activeId: parsed.id, profiles: nextProfiles };
      });
    } catch {
      alert("Invalid profile JSON");
    }
  };

  const resetBenchmark = () => {
    const original = fm27BenchmarkProfiles().find((p) => p.id === active.id);
    if (!original) return;
    updateActive(() => withNormalizedWeights(original));
  };

  const setEmphasis = (emphasis: WeightEmphasis) => {
    updateActive((p) => ({ ...p, emphasis }));
  };

  const setWeight = (key: AttributeKey, value: number) => {
    updateActive((p) => ({
      ...p,
      weights: {
        ...p.weights,
        [key]: clampWeight(value),
      },
    }));
  };

  const renderGroup = (title: string, keys: AttributeKey[]) => {
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    const used = sorted.filter((k) => pWeight(active.weights, k) > 0).length;
    return (
      <section>
        <h3 className="section-title sticky top-0 z-[1] -mx-5 flex items-baseline justify-between border-y border-line bg-paper px-5 py-1.5">
          {title}
          <span className="text-[12px] font-normal text-muted">{used} weighted</span>
        </h3>
        <div className="py-1">
          {sorted.map((k) => {
            const w = pWeight(active.weights, k);
            return (
              <label
                key={k}
                className="flex items-center justify-between gap-3 py-[3px]"
              >
                <span className={`text-sm ${w > 0 ? "font-semibold" : "text-muted"}`}>
                  {titleCaseFromCamel(k)}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 w-16 overflow-hidden rounded-full bg-line/70"
                  >
                    <span
                      className="block h-full rounded-full bg-series-1"
                      style={{ width: `${(w / WEIGHT_MAX) * 100}%` }}
                    />
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={WEIGHT_MAX}
                    step={1}
                    className={`field h-8 w-14 px-2 text-right text-sm ${w > 0 ? "font-semibold" : "text-muted"}`}
                    value={w}
                    onChange={(e) => setWeight(k, safeNumber(e.target.value))}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </section>
    );
  };

  const footer = useMemo(
    () => (
      <p className="text-[13px] text-muted">
        Weights are applied to the score immediately.
      </p>
    ),
    [],
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Attribute Weights"
      description="Adjust how each attribute contributes to the computed score. Higher weight means more impact."
      placement="side"
      footer={footer}
    >
      <div className="space-y-4">
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

        <div className="space-y-2 rounded-md bg-paper px-3 py-2.5 text-[13px]">
          <label className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">Weighting</span>
            <select
              className="field h-8 pl-2.5 text-sm"
              value={active.emphasis ?? LEGACY_EMPHASIS}
              onChange={(e) => setEmphasis(Number(e.target.value) as WeightEmphasis)}
            >
              <option value={1}>Linear (FM27 benchmark)</option>
              <option value={2}>Emphasized (weights squared)</option>
            </select>
          </label>
          {active.builtIn === "fm27" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">Benchmarked FM27 role weights (fm-scoring).</span>
              <Button color="alt" variant="outline" size="sm" onClick={resetBenchmark}>
                Reset to benchmark
              </Button>
            </div>
          ) : (
            <p className="text-muted">
              Linear matches how the FM27 benchmarks and &ldquo;vs Age&rdquo; are calibrated.
            </p>
          )}
        </div>

        <div>
          {renderGroup("Technical", TECHNICAL_KEYS)}
          {renderGroup("Mental", MENTAL_KEYS)}
          {renderGroup("Physical", PHYSICAL_KEYS)}
          {renderGroup("Goalkeeping", GOALKEEPING_KEYS)}
        </div>

        <details className="group rounded-md border border-line">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
            Import / export JSON
          </summary>
          <div className="space-y-2 border-t border-line px-3 py-3">
            <div className="flex gap-1.5">
              <Button color="alt" variant="outline" size="sm" onClick={exportProfile}>
                Export
              </Button>
              <Button color="alt" variant="outline" size="sm" onClick={importProfile}>
                Import
              </Button>
            </div>
            <textarea
              aria-label="Profile JSON"
              className="field h-32 w-full p-2.5 font-[ui-monospace,Consolas,monospace] text-xs"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder="Exported profile JSON will appear here. Paste JSON here to import."
            />
          </div>
        </details>
      </div>
    </Modal>
  );
}

function pWeight(weights: AttributeWeights, key: AttributeKey) {
  const v = weights[key];
  return typeof v === "number" ? v : 0;
}

function clampWeight(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(WEIGHT_MAX, Math.max(0, Math.round(value)));
}

function defaultWeights(): AttributeWeights {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, 0])) as AttributeWeights;
}

function withNormalizedWeights(profile: WeightProfile): WeightProfile {
  const weights = profile.weights ?? {};
  const normalized: AttributeWeights = {};

  for (const k of ALL_KEYS) {
    const raw = weights[k];
    normalized[k] = clampWeight(typeof raw === "number" ? raw : 0);
  }

  const emphasis: WeightEmphasis =
    profile.emphasis === 1 || profile.emphasis === 2
      ? profile.emphasis
      : profile.builtIn
        ? 1
        : LEGACY_EMPHASIS;
  return { ...profile, weights: normalized, emphasis };
}
