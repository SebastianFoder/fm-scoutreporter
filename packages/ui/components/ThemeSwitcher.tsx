"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, DEFAULT_THEME_KEY, type ThemeKey } from "@scoutreporter/core/themes";
import { SegmentedControl } from "./SegmentedControl";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

/** The theme choice: light, dark, or "system" (follow the OS, which is what an unset choice does). */
export type ThemeChoice = ThemeKey | "system";

function subscribe(callback: () => void) {
  listeners.add(callback);

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
    mql.removeEventListener("change", callback);
  };
}

function storedChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function getSnapshot(): ThemeKey {
  const choice = storedChoice();
  if (choice !== "system") return choice;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): ThemeKey {
  return DEFAULT_THEME_KEY;
}

function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
  listeners.forEach((l) => l());
}

/** The theme in use (light or dark). */
export function useTheme(): ThemeKey {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Applies the theme in use to the page. Mounted once, in the site header. */
export function ThemeSync() {
  const theme = useTheme();
  useEffect(() => {
    applyTheme(theme);
    document.body.style.backgroundColor = `oklch(var(--background))`;
  }, [theme]);
  return null;
}

/** Light, dark, or follow the system: the theme row in Settings. */
export function ThemeSetting() {
  // The choice, not the theme it resolves to: Dark and System can both mean dark.
  const choice = useSyncExternalStore(subscribe, storedChoice, (): ThemeChoice => "system");
  return (
    <SegmentedControl<ThemeChoice>
      value={choice}
      onChange={setThemeChoice}
      label="Theme"
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System" },
      ]}
    />
  );
}
