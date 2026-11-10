export type ThemeKey = "light" | "dark";

/** One attribute band: cell fill and the text colour that sits on it. */
export interface ThemeBand {
  fill: string;
  ink: string;
}

/** FM attribute value bands (1–20) — a one-hue ordinal ramp, lightest = lowest. */
export interface ThemeAttributeBands {
  excellent: ThemeBand;
  good: ThemeBand;
  average: ThemeBand;
  low: ThemeBand;
}

export interface ThemeConfig {
  name: string;
  /** Interactive accent: primary buttons, links, selected controls. oklch triplet "L C H". */
  primary: string;
  onPrimary: string;
  /** Positive values (≥ benchmark). */
  alt: string;
  onAlt: string;
  text: string;
  /** Secondary text. */
  muted: string;
  background: string;
  surface: string;
  border: string;
  /** App bar. */
  chrome: string;
  onChrome: string;
  /** First data series (role bars, focus ring). */
  series1: string;
  attributeBands: ThemeAttributeBands;
  specials: {
    red: { bg: string; text: string };
    gold: { bg: string; text: string };
    silver: { bg: string; text: string };
    bronze: { bg: string; text: string };
  };
}

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  light: {
    name: "Light",
    background: "0.968 0.003 250",
    surface: "1 0 0",
    border: "0.885 0.006 250",
    text: "0.235 0.012 255",
    muted: "0.52 0.012 255",
    primary: "0.42 0.12 255",
    onPrimary: "1 0 0",
    alt: "0.5 0.12 150",
    onAlt: "1 0 0",
    chrome: "0.25 0.035 255",
    onChrome: "0.97 0.005 255",
    series1: "0.58 0.15 255",
    attributeBands: {
      excellent: { fill: "0.53 0.12 150", ink: "1 0 0" },
      good: { fill: "0.82 0.08 150", ink: "0.235 0.012 255" },
      average: { fill: "0.945 0.025 150", ink: "0.235 0.012 255" },
      low: { fill: "1 0 0 / 0", ink: "0.52 0.012 255" },
    },
    specials: {
      red: { bg: "0.55 0.19 27", text: "1 0 0" },
      gold: { bg: "0.83 0.14 88", text: "0.25 0.04 88" },
      silver: { bg: "0.86 0.008 255", text: "0.25 0.01 255" },
      bronze: { bg: "0.7 0.11 55", text: "0.2 0.03 55" },
    },
  },
  dark: {
    name: "Dark",
    background: "0.165 0.008 255",
    surface: "0.205 0.01 255",
    border: "0.3 0.012 255",
    text: "0.93 0.005 255",
    muted: "0.68 0.01 255",
    primary: "0.74 0.11 255",
    onPrimary: "0.18 0.02 255",
    alt: "0.75 0.14 150",
    onAlt: "0.17 0.03 150",
    chrome: "0.13 0.012 255",
    onChrome: "0.95 0.005 255",
    series1: "0.63 0.15 255",
    attributeBands: {
      excellent: { fill: "0.75 0.13 150", ink: "0.18 0.03 150" },
      good: { fill: "0.48 0.09 150", ink: "1 0 0" },
      average: { fill: "0.32 0.045 150", ink: "0.93 0.005 255" },
      low: { fill: "0 0 0 / 0", ink: "0.66 0.01 255" },
    },
    specials: {
      red: { bg: "0.62 0.19 27", text: "0.15 0.02 27" },
      gold: { bg: "0.82 0.14 88", text: "0.2 0.04 88" },
      silver: { bg: "0.8 0.008 255", text: "0.2 0.01 255" },
      bronze: { bg: "0.68 0.11 55", text: "0.16 0.03 55" },
    },
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = "light";

export function applyTheme(key: ThemeKey) {
  if (typeof document === "undefined") return;
  const theme = THEMES[key];
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  root.setAttribute("data-theme", key);

  set("--primary", theme.primary);
  set("--on-primary", theme.onPrimary);
  set("--alt", theme.alt);
  set("--on-alt", theme.onAlt);
  set("--text", theme.text);
  set("--muted", theme.muted);
  set("--background", theme.background);
  set("--surface", theme.surface);
  set("--border", theme.border);
  set("--chrome", theme.chrome);
  set("--on-chrome", theme.onChrome);
  set("--series-1", theme.series1);

  set("--red-bg", theme.specials.red.bg);
  set("--red-text", theme.specials.red.text);
  set("--gold-bg", theme.specials.gold.bg);
  set("--gold-text", theme.specials.gold.text);
  set("--silver-bg", theme.specials.silver.bg);
  set("--silver-text", theme.specials.silver.text);
  set("--bronze-bg", theme.specials.bronze.bg);
  set("--bronze-text", theme.specials.bronze.text);

  for (const band of ["excellent", "good", "average", "low"] as const) {
    set(`--attr-${band}`, theme.attributeBands[band].fill);
    set(`--attr-${band}-ink`, theme.attributeBands[band].ink);
  }
}
