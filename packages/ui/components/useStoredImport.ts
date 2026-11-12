"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  loadImport,
  readImport,
  removeImport,
  subscribeImports,
  writeImport,
} from "@scoutreporter/core/storage/import-store";

/**
 * Persistence for one imported dataset (see `@scoutreporter/core/storage/import-store`).
 *
 * On mount it loads the stored import (moving a pre-IndexedDB localStorage copy across) and calls
 * `onStored` with it. It calls `onStored` again when another tab changes the import, with null when
 * it was cleared. A load that finishes after the user already imported or cleared is ignored.
 */
export function useStoredImport(
  key: string,
  onStored: (text: string | null) => void,
  legacySessionKey?: string,
) {
  const touched = useRef(false);
  const onStoredRef = useRef(onStored);
  useEffect(() => {
    onStoredRef.current = onStored;
  });

  useEffect(() => {
    let active = true;
    void loadImport(key, { legacySessionKey }).then((text) => {
      if (active && !touched.current && text) onStoredRef.current(text);
    });
    const unsubscribe = subscribeImports((changed) => {
      if (changed !== key) return;
      void readImport<string>(key).then((text) => {
        if (!active) return;
        touched.current = true;
        onStoredRef.current(text);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, legacySessionKey]);

  /** Store a new import. Resolves false when it could not be kept beyond this tab. */
  const save = useCallback(
    (text: string) => {
      touched.current = true;
      return writeImport(key, text);
    },
    [key],
  );

  const remove = useCallback(() => {
    touched.current = true;
    return removeImport(key, legacySessionKey);
  }, [key, legacySessionKey]);

  return { save, remove };
}
