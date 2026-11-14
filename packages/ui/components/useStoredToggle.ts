"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
/** Choices made while storage is blocked: kept until the page closes. */
const memory = new Map<string, boolean>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = () => callback();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function read(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : fallback;
  } catch {
    return memory.get(key) ?? fallback;
  }
}

/** An on/off choice remembered in this browser (or the app), e.g. whether a list shows your own club. */
export function useStoredToggle(key: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (on: boolean) => {
      try {
        window.localStorage.setItem(key, on ? "1" : "0");
      } catch {
        memory.set(key, on);
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
