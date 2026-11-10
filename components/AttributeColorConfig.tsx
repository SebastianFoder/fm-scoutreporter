"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type AttributeBand = "excellent" | "good" | "average" | "low";

export interface AttributeColorProfile {
  id: string;
  name: string;
  thresholds: {
    excellent: number;
    good: number;
    average: number;
  };
}

const ATTR_BAND_VARS: Record<AttributeBand, string> = {
  excellent: "--attr-excellent",
  good: "--attr-good",
  average: "--attr-average",
  low: "--attr-low",
};

/** Resolved fill colour for an attribute band (follows light/dark theme). Cells use the `.attr` class instead. */
export function attributeBandColor(band: AttributeBand): string {
  return `oklch(var(${ATTR_BAND_VARS[band]}))`;
}

const STORAGE_KEY = "attributeColorProfiles";

const DEFAULT_PROFILE: AttributeColorProfile = {
  id: "default",
  name: "Default",
  thresholds: {
    excellent: 16,
    good: 11,
    average: 6,
  },
};

interface StoredConfig {
  activeId: string;
  profiles: AttributeColorProfile[];
}

function clampThreshold(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(0, Math.round(n)));
}

function parseProfile(raw: unknown): AttributeColorProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const t = o.thresholds;
  const tp = t && typeof t === "object" ? (t as Record<string, unknown>) : {};
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "Profile",
    thresholds: {
      excellent: clampThreshold(
        Number(tp.excellent),
        DEFAULT_PROFILE.thresholds.excellent,
      ),
      good: clampThreshold(Number(tp.good), DEFAULT_PROFILE.thresholds.good),
      average: clampThreshold(
        Number(tp.average),
        DEFAULT_PROFILE.thresholds.average,
      ),
    },
  };
}

function migrateStoredConfig(parsed: unknown): StoredConfig {
  const fallback: StoredConfig = {
    activeId: DEFAULT_PROFILE.id,
    profiles: [DEFAULT_PROFILE],
  };
  if (!parsed || typeof parsed !== "object") return fallback;
  const o = parsed as Record<string, unknown>;
  const rawProfiles = o.profiles;
  if (!Array.isArray(rawProfiles) || rawProfiles.length === 0) return fallback;

  const profiles = rawProfiles
    .map(parseProfile)
    .filter((p): p is AttributeColorProfile => p !== null);

  if (profiles.length === 0) return fallback;

  const activeId =
    typeof o.activeId === "string" &&
    profiles.some((p) => p.id === o.activeId)
      ? o.activeId
      : profiles[0].id;

  return { activeId, profiles };
}

function loadFromStorage(): StoredConfig {
  if (typeof window === "undefined") {
    return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
    return migrateStoredConfig(JSON.parse(raw) as unknown);
  } catch {
    return { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] };
  }
}

function saveToStorage(config: StoredConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getBandForValue(
  value: number,
  thresholds: AttributeColorProfile["thresholds"],
): AttributeBand {
  if (value >= thresholds.excellent) return "excellent";
  if (value >= thresholds.good) return "good";
  if (value >= thresholds.average) return "average";
  return "low";
}

export function useActiveAttributeProfile(): AttributeColorProfile {
  const ctx = useAttributeColorContext();
  const { activeId, profiles } = ctx.state;
  return (
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? DEFAULT_PROFILE
  );
}

type AttributeColorContextValue = {
  state: StoredConfig;
  setState: Dispatch<SetStateAction<StoredConfig>>;
};

const AttributeColorContext = createContext<AttributeColorContextValue | null>(
  null,
);

export function AttributeColorProvider({
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
    const stored = loadFromStorage();
    setState(stored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  return (
    <AttributeColorContext.Provider value={{ state, setState }}>
      {children}
    </AttributeColorContext.Provider>
  );
}

function useAttributeColorContext(): AttributeColorContextValue {
  const ctx = useContext(AttributeColorContext);
  if (!ctx) {
    return {
      state: { activeId: DEFAULT_PROFILE.id, profiles: [DEFAULT_PROFILE] },
      setState: () => {},
    };
  }
  return ctx;
}

export function AttributeColorConfig() {
  const [open, setOpen] = useState(false);
  const { state, setState } = useAttributeColorContext();
  const { activeId, profiles } = state;

  const active =
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? DEFAULT_PROFILE;

  const updateActive = (
    updater: (p: AttributeColorProfile) => AttributeColorProfile,
  ) => {
    setState((prev) => ({
      activeId: prev.activeId,
      profiles: prev.profiles.map((p) => (p.id === active.id ? updater(p) : p)),
    }));
  };

  const addProfile = () => {
    const id = `profile-${Date.now()}`;
    const next: AttributeColorProfile = {
      id,
      name: `${active.name} Copy`,
      thresholds: { ...active.thresholds },
    };
    setState((prev) => ({
      activeId: id,
      profiles: [...prev.profiles, next],
    }));
  };

  const deleteProfile = () => {
    if (profiles.length <= 1) return;
    const remaining = profiles.filter((p) => p.id !== active.id);
    setState({
      activeId: remaining[0].id,
      profiles: remaining,
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Attribute thresholds"
        aria-label="Attribute thresholds"
        className="btn h-8 gap-1.5 px-2 text-[13px] font-medium text-on-chrome/80 hover:bg-on-chrome/10 hover:text-on-chrome"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Thresholds</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Attribute thresholds"
        description="Set numeric bands for attribute values (1–20). Colours follow the current light or dark theme. Saved per profile."
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
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
            <div className="flex gap-1.5 sm:col-span-2">
              <Button color="alt" variant="outline" size="sm" onClick={addProfile}>
                Duplicate
              </Button>
              <Button
                color="red"
                variant="outline"
                size="sm"
                onClick={deleteProfile}
                disabled={profiles.length <= 1}
              >
                Delete
              </Button>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Band</th>
                <th className="px-3 py-2 text-left">Min value</th>
              </tr>
            </thead>
            <tbody>
              {(
                ["excellent", "good", "average"] as const satisfies ReadonlyArray<
                  keyof AttributeColorProfile["thresholds"]
                >
              ).map((band) => (
                <ThresholdRow
                  key={band}
                  band={band}
                  threshold={active.thresholds[band]}
                  onThresholdChange={(val) =>
                    updateActive((p) => ({
                      ...p,
                      thresholds: { ...p.thresholds, [band]: val },
                    }))
                  }
                />
              ))}

              <ThresholdRow
                band="low"
                readOnlyThreshold
                belowMax={active.thresholds.average}
              />
            </tbody>
          </table>

          <div>
            <p className="mb-1.5 text-[13px] text-muted">Preview, 1 to 20</p>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((v) => (
                <span key={v} className="attr" data-band={getBandForValue(v, active.thresholds)}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ThresholdRow(props: {
  band: AttributeBand;
  threshold?: number;
  readOnlyThreshold?: boolean;
  /** For low band: show “below &lt;this&gt;” */
  belowMax?: number;
  onThresholdChange?: (value: number) => void;
}) {
  const { band, readOnlyThreshold, belowMax, onThresholdChange } = props;
  const threshold = props.threshold ?? 0;

  const pretty =
    band[0].toUpperCase() + band.slice(1).toLowerCase() + " attribute";

  return (
    <tr>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2.5">
          <span className="attr" data-band={band}>
            {band === "low" ? Math.max(1, (belowMax ?? 1) - 1) : threshold}
          </span>
          {pretty}
        </span>
      </td>
      <td className="px-3 py-2">
        {readOnlyThreshold ? (
          <span className="text-sm text-muted">
            {belowMax !== undefined ? (
              <>
                Below <span className="font-semibold text-ink">{belowMax}</span>
              </>
            ) : (
              <>—</>
            )}
          </span>
        ) : (
          <input
            type="number"
            min={0}
            max={20}
            aria-label={`${pretty} minimum value`}
            className="field h-8 w-16 px-2 text-right text-sm"
            value={threshold}
            onChange={(e) => onThresholdChange?.(Number(e.target.value) || 0)}
          />
        )}
      </td>
    </tr>
  );
}
