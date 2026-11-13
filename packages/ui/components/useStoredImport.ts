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
  /** A CSV string, or a records object (see `@scoutreporter/core/storage/stored-records`); null when cleared. */
  onStored: (value: unknown) => void,
  legacySessionKey?: string,
) {
  const touched = useRef(false);
  const onStoredRef = useRef(onStored);
  useEffect(() => {
    onStoredRef.current = onStored;
  });

  useEffect(() => {
    let active = true;
    void loadImport<unknown>(key, { legacySessionKey }).then((value) => {
      if (active && !touched.current && value) onStoredRef.current(value);
    });
    const unsubscribe = subscribeImports((changed) => {
      if (changed !== key) return;
      void readImport<unknown>(key).then((value) => {
        if (!active) return;
        touched.current = true;
        onStoredRef.current(value);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, legacySessionKey]);

  /** Store a new import (CSV text or a records object). Resolves false when it could not be kept beyond this tab. */
  const save = useCallback(
    (value: unknown) => {
      touched.current = true;
      return writeImport(key, value);
    },
    [key],
  );

  const remove = useCallback(() => {
    touched.current = true;
    return removeImport(key, legacySessionKey);
  }, [key, legacySessionKey]);

  return { save, remove };
}
