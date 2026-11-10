"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, DEFAULT_THEME_KEY, type ThemeKey } from "@/lib/themes";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

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

function getSnapshot(): ThemeKey {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function getServerSnapshot(): ThemeKey {
  return DEFAULT_THEME_KEY;
}

function setThemeValue(key: ThemeKey) {
  window.localStorage.setItem(STORAGE_KEY, key);
  applyTheme(key);
  document.body.style.backgroundColor = `oklch(var(--background))`;
  listeners.forEach((l) => l());
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
    document.body.style.backgroundColor = `oklch(var(--background))`;
  }, [theme]);

  const toDark = theme === "light";

  return (
    <button
      type="button"
      onClick={() => setThemeValue(toDark ? "dark" : "light")}
      aria-label={toDark ? "Switch to dark theme" : "Switch to light theme"}
      title={toDark ? "Dark theme" : "Light theme"}
      className="btn h-8 w-8 text-on-chrome/80 hover:bg-on-chrome/10 hover:text-on-chrome"
    >
      {toDark ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
    </button>
  );
}
