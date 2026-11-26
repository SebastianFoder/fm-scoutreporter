"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslations } from "next-intl";
import type {
  AttributeKey,
  AttributeWeights,
  WeightEmphasis,
  WeightProfile,
} from "@scoutreporter/core/types/weights";
import { Button } from "./Button";
import {
  ALL_ATTRIBUTE_KEYS as ALL_KEYS,
  GOALKEEPING_KEYS,
  MENTAL_KEYS,
  PHYSICAL_KEYS,
  TECHNICAL_KEYS,
} from "@scoutreporter/core/attribute-keys";
import { fm27BenchmarkProfiles } from "@scoutreporter/core/fm27/benchmarks";
import {
  migrateWeightConfig,
  WEIGHT_SEED_VERSION,
  type StoredWeightConfig,
} from "@scoutreporter/core/fm27/profile-migration";
import { LEGACY_EMPHASIS } from "@scoutreporter/core/scoring";
import { useAttributeLabel, useIntlLocale, useProfileName } from "../i18n/hooks";

const STORAGE_KEY = "weightProfiles";

/** Upper bound for per-attribute weight inputs and stored values (wider ratio vs min 0). */
const WEIGHT_MAX = 20;

const DEFAULT_PROFILE: WeightProfile = {
  id: "default",
  name: "Default",
  weights: {},
  emphasis: 1,
};

const FIRST_RUN_ACTIVE_ID = "fm27-10";

const STUDY_13B_URL =
  "https://github.com/caiograco289/Fm-Match-Lab/blob/main/docs/studies/13b-value-by-position-random.md";

type StoredConfig = StoredWeightConfig;

type WeightContextValue = {
  state: StoredConfig;
  setState: Dispatch<SetStateAction<StoredConfig>>;
};

const WeightContext = createContext<WeightContextValue | null>(null);

function initialConfig(): StoredConfig {
  return {
    activeId: FIRST_RUN_ACTIVE_ID,
    profiles: [DEFAULT_PROFILE, ...fm27BenchmarkProfiles()].map(withNormalizedWeights),
    seeded: WEIGHT_SEED_VERSION,
  };
}

function loadFromStorage(): StoredConfig {
  if (typeof window === "undefined") return initialConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialConfig();
    const parsed = JSON.parse(raw) as StoredConfig;
    if (!parsed.profiles?.length) return initialConfig();
    // Seed benchmark profiles the user hasn't had yet and move saved FM27 profiles to the current benchmarks.
    const migrated = migrateWeightConfig({
      activeId: parsed.activeId ?? DEFAULT_PROFILE.id,
      profiles: parsed.profiles.map(withNormalizedWeights),
      seeded: parsed.seeded,
    });
    return { ...migrated, profiles: migrated.profiles.map(withNormalizedWeights) };
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

function safeNumber(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n);
  return clampWeight(rounded);
}

/** The Weights tab in Settings: weight profiles and every attribute's weight. */
export function WeightSettings() {
  const { state, setState } = useWeightContext();
  const { activeId, profiles } = state;
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tGroups = useTranslations("fm.attributeGroups");
  const attributeLabel = useAttributeLabel();
  const intlLocale = useIntlLocale();
  const profileName = useProfileName();
  /** The built-in default's name in the current language; any other name as stored. */
  const displayName = (p: WeightProfile) =>
    p.id === DEFAULT_PROFILE.id && p.name === DEFAULT_PROFILE.name ? t("profiles.default") : profileName(p);

  const active =
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? DEFAULT_PROFILE;

  // Starts empty every time the tab is opened (switching tabs or closing Settings unmounts it).
  const [json, setJson] = useState("");

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
      name: t("profiles.newName"),
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
      name: t("profiles.copyName", { name: displayName(active) }),
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
      alert(t("weights.json.invalid"));
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
    const sorted = [...keys].sort((a, b) => attributeLabel(a).localeCompare(attributeLabel(b), intlLocale));
    const used = sorted.filter((k) => pWeight(active.weights, k) > 0).length;
    return (
      <section>
        <h3 className="section-title sticky top-0 z-[1] -mx-5 flex items-baseline justify-between border-y border-line bg-paper px-5 py-1.5">
          {title}
          <span className="text-[12px] font-normal text-muted">{t("weights.weighted", { count: used })}</span>
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
                  {attributeLabel(k)}
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

  return (
      <div className="space-y-4">
      <p className="text-[13px] text-muted">{t("weights.intro")}</p>

        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            {t("profiles.profile")}
            <select
              className="field h-9 w-full pl-2.5 text-sm font-semibold text-ink"
              value={active.id}
              onChange={(e) =>
                setState((prev) => ({ ...prev, activeId: e.target.value }))
              }
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            {t("profiles.name")}
            <input
              type="text"
              className="field h-9 w-full px-2.5 text-sm text-ink"
              value={active.name}
              onChange={(e) =>
                updateActive((p) => ({ ...p, name: e.target.value }))
              }
              placeholder={t("profiles.namePlaceholder")}
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button color="alt" variant="outline" size="sm" onClick={createNew}>
              {t("profiles.createNew")}
            </Button>
            <Button color="alt" variant="outline" size="sm" onClick={duplicate}>
              {tCommon("duplicate")}
            </Button>
            <Button
              color="red"
              variant="outline"
              size="sm"
              onClick={remove}
              disabled={profiles.length <= 1}
            >
              {tCommon("delete")}
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md bg-paper px-3 py-2.5 text-[13px]">
          <label className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">{t("weights.weighting")}</span>
            <select
              className="field h-8 pl-2.5 text-sm"
              value={active.emphasis ?? LEGACY_EMPHASIS}
              onChange={(e) => setEmphasis(Number(e.target.value) as WeightEmphasis)}
            >
              <option value={1}>{t("weights.linear")}</option>
              <option value={2}>{t("weights.emphasized")}</option>
            </select>
          </label>
          {active.builtIn === "fm27" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">
                {t.rich(
                  t.has(`weights.profileDescriptions.${active.id}`)
                    ? `weights.profileDescriptions.${active.id}`
                    : "weights.benchmark",
                  {
                    link: (chunks) => (
                      <a href={STUDY_13B_URL} className="link" target="_blank" rel="noreferrer">
                        {chunks}
                      </a>
                    ),
                  },
                )}
              </span>
              <Button color="alt" variant="outline" size="sm" onClick={resetBenchmark}>
                {t("weights.resetToBenchmark")}
              </Button>
            </div>
          ) : (
            <p className="text-muted">
              {t("weights.linearNote")}
            </p>
          )}
        </div>

        <div>
          {renderGroup(tGroups("technical"), TECHNICAL_KEYS)}
          {renderGroup(tGroups("mental"), MENTAL_KEYS)}
          {renderGroup(tGroups("physical"), PHYSICAL_KEYS)}
          {renderGroup(tGroups("goalkeeping"), GOALKEEPING_KEYS)}
        </div>

        <details className="group rounded-md border border-line">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
            {t("weights.json.title")}
          </summary>
          <div className="space-y-2 border-t border-line px-3 py-3">
            <div className="flex gap-1.5">
              <Button color="alt" variant="outline" size="sm" onClick={exportProfile}>
                {tCommon("export")}
              </Button>
              <Button color="alt" variant="outline" size="sm" onClick={importProfile}>
                {tCommon("import")}
              </Button>
            </div>
            <textarea
              aria-label={t("weights.json.label")}
              className="field h-32 w-full p-2.5 font-[ui-monospace,Consolas,monospace] text-xs"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={t("weights.json.placeholder")}
            />
          </div>
        </details>
      </div>
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
