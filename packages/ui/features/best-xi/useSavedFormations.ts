"use client";

import { useCallback, useEffect, useState } from "react";
import { formation, isFormationSpot, isValidFormation, type Formation } from "@scoutreporter/core/best-xi/formations";

/** Formations the user saved from the tactics pitch, shared by Best XI and Squad analysis. */
export const SAVED_FORMATIONS_KEY = "savedFormations";

function read(): Formation[] {
  try {
    const raw = window.localStorage.getItem(SAVED_FORMATIONS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((x) => {
      if (typeof x?.id !== "string" || typeof x?.name !== "string" || !Array.isArray(x?.spots)) return [];
      if (!x.spots.every(isFormationSpot) || !isValidFormation(x.spots)) return [];
      return [formation(x.id, x.name, x.spots.join(" "))];
    });
  } catch {
    return [];
  }
}

function write(list: Formation[]) {
  try {
    window.localStorage.setItem(
      SAVED_FORMATIONS_KEY,
      JSON.stringify(list.map(({ id, name, spots }) => ({ id, name, spots }))),
    );
  } catch {
    // storage full or blocked: saved formations last for this visit only
  }
}

export function useSavedFormations() {
  const [saved, setSaved] = useState<Formation[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect -- post-SSR localStorage hydration */
  useEffect(() => {
    setSaved(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SAVED_FORMATIONS_KEY) setSaved(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Save under a name; a formation with the same name is replaced. Returns the saved formation. */
  const save = useCallback((name: string, spots: Formation["spots"]): Formation => {
    const trimmed = name.trim();
    const current = read();
    const existing = current.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
    const f = formation(existing?.id ?? `saved-${Date.now().toString(36)}`, trimmed, spots.join(" "));
    const next = existing ? current.map((x) => (x.id === existing.id ? f : x)) : [...current, f];
    write(next);
    setSaved(next);
    return f;
  }, []);

  const remove = useCallback((id: string) => {
    const next = read().filter((f) => f.id !== id);
    write(next);
    setSaved(next);
  }, []);

  return { saved, save, remove };
}
