"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { applyTheme, type ThemeKey } from "@scoutreporter/core/themes";
import { SegmentedControl } from "./SegmentedControl";

export const THEME_STORAGE_KEY = "theme";
export const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

/** The theme choice: light, dark, or "system" (follow the OS, which is what an unset choice does). */
export type ThemeChoice = ThemeKey | "system";

function subscribe(callback: () => void) {
  listeners.add(callback);

  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);

  const mql = window.matchMedia(DARK_THEME_QUERY);
  mql.addEventListener("change", callback);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
    mql.removeEventListener("change", callback);
  };
}

function storedChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function getSnapshot(): ThemeKey {
  const choice = storedChoice();
  if (choice !== "system") return choice;
  return window.matchMedia(DARK_THEME_QUERY).matches ? "dark" : "light";
}

function getServerSnapshot(): null {
  return null;
}

function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
  listeners.forEach((l) => l());
}

/** The theme in use (light or dark). */
export function useTheme(): ThemeKey | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Applies the theme in use to the page. Mounted once, in the site header. */
export function ThemeSync() {
  const theme = useTheme();
  useEffect(() => {
    if (theme === null) return;
    applyTheme(theme);
    document.body.style.backgroundColor = `oklch(var(--background))`;
  }, [theme]);
  return null;
}

/** Light, dark, or follow the system: the theme row in Settings. */
export function ThemeSetting() {
  // The choice, not the theme it resolves to: Dark and System can both mean dark.
  const choice = useSyncExternalStore(subscribe, storedChoice, (): ThemeChoice => "system");
  const t = useTranslations("settings.theme");
  return (
    <SegmentedControl<ThemeChoice>
      value={choice}
      onChange={setThemeChoice}
      label={t("label")}
      options={[
        { value: "light", label: t("light") },
        { value: "dark", label: t("dark") },
        { value: "system", label: t("system") },
      ]}
    />
  );
}
