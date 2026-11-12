/**
 * Storage for imported datasets (player, squad and staff CSVs, and desktop scans).
 *
 * A full-database export is tens of megabytes, far past localStorage's ~5 MB, so imports live in
 * IndexedDB. Small settings (profiles, theme, formations) stay in localStorage.
 *
 * Every function here resolves and never throws. When IndexedDB is unavailable (blocked, private
 * mode in some browsers, Storybook), string values fall back to localStorage under the same key,
 * the old behaviour, and anything else falls back to memory for the current tab.
 *
 * Imports used to be stored in localStorage (and, for the oldest player imports, sessionStorage).
 * `loadImport` moves such a value into IndexedDB the first time it is read.
 *
 * Tabs are kept in sync with a BroadcastChannel: every write or removal tells the other tabs which
 * key changed, and `subscribeImports` listeners reload it.
 */

const DB_NAME = "scoutreporter";
const DB_VERSION = 1;
const STORE = "imports";
const CHANNEL = "scoutreporter-imports";

/** Where values end up: IndexedDB, the localStorage fallback, or memory (this tab only). */
export type ImportBackendKind = "indexeddb" | "localstorage" | "memory";

interface Backend {
  kind: ImportBackendKind;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

function memoryBackend(): Backend {
  const map = new Map<string, unknown>();
  return {
    kind: "memory",
    get: async (key) => map.get(key),
    set: async (key, value) => void map.set(key, value),
    delete: async (key) => void map.delete(key),
  };
}

/** The pre-IndexedDB behaviour: strings in localStorage, anything else in memory. */
function localStorageBackend(): Backend {
  const memory = memoryBackend();
  return {
    kind: "localstorage",
    async get(key) {
      const stored = window.localStorage.getItem(key);
      return stored ?? memory.get(key);
    },
    async set(key, value) {
      if (typeof value === "string") window.localStorage.setItem(key, value);
      else await memory.set(key, value);
    },
    async delete(key) {
      window.localStorage.removeItem(key);
      await memory.delete(key);
    },
  };
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

function indexedDbBackend(db: IDBDatabase): Backend {
  const run = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) => {
    const tx = db.transaction(STORE, mode);
    const result = request(fn(tx.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
    return result;
  };
  return {
    kind: "indexeddb",
    get: (key) => run("readonly", (s) => s.get(key)),
    set: async (key, value) => void (await run("readwrite", (s) => s.put(value, key))),
    delete: async (key) => void (await run("readwrite", (s) => s.delete(key))),
  };
}

let backendPromise: Promise<Backend> | null = null;

function hasWindowStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function backend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (typeof indexedDB !== "undefined") {
        try {
          return indexedDbBackend(await openDatabase());
        } catch {
          // blocked or broken: fall through
        }
      }
      return hasWindowStorage() ? localStorageBackend() : memoryBackend();
    })();
  }
  return backendPromise;
}

/** Which backend imports are stored in (for messages and tests). */
export async function importBackendKind(): Promise<ImportBackendKind> {
  return (await backend()).kind;
}

/**
 * Store everything in memory from now on, starting empty. For Storybook and tests, so each story or
 * test starts from a clean slate without touching the visitor's real data.
 */
export function resetImportStoreToMemory(): void {
  backendPromise = Promise.resolve(memoryBackend());
}

/** Forget the chosen backend, so the next call picks one again. For tests. */
export function resetImportStore(): void {
  backendPromise = null;
}

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    try {
      channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    } catch {
      channel = null;
    }
  }
  return channel;
}

function announce(key: string) {
  try {
    getChannel()?.postMessage({ key });
  } catch {
    // other tabs just won't refresh
  }
}

/** The stored value, or null when there is none or storage failed. */
export async function readImport<T = string>(key: string): Promise<T | null> {
  try {
    const value = await (await backend()).get(key);
    return value === undefined || value === null ? null : (value as T);
  } catch {
    return null;
  }
}

/**
 * Store a value. Resolves true when it will survive a reload (IndexedDB or localStorage), false when
 * it is kept in memory for this tab only or could not be stored at all.
 */
export async function writeImport(key: string, value: unknown): Promise<boolean> {
  try {
    const b = await backend();
    await b.set(key, value);
    if (b.kind === "indexeddb") removeLegacy(key);
    announce(key);
    return b.kind !== "memory" && (b.kind !== "localstorage" || typeof value === "string");
  } catch {
    return false;
  }
}

/** Remove a stored value (and any pre-IndexedDB copy of it). */
export async function removeImport(key: string, legacySessionKey?: string): Promise<void> {
  try {
    await (await backend()).delete(key);
  } catch {
    // nothing stored, or storage blocked
  }
  removeLegacy(key, legacySessionKey);
  announce(key);
}

function removeLegacy(key: string, sessionKey?: string) {
  try {
    window.localStorage.removeItem(key);
    if (sessionKey) window.sessionStorage.removeItem(sessionKey);
  } catch {
    // storage blocked
  }
}

function readLegacy(key: string, sessionKey?: string): string | null {
  try {
    return (
      window.localStorage.getItem(key) ?? (sessionKey ? window.sessionStorage.getItem(sessionKey) : null)
    );
  } catch {
    return null;
  }
}

/**
 * Read an import, moving a pre-IndexedDB copy (localStorage under the same key, or sessionStorage
 * under `legacySessionKey`) into IndexedDB first. The old copy is removed only once IndexedDB has it.
 */
export async function loadImport<T = string>(
  key: string,
  { legacySessionKey }: { legacySessionKey?: string } = {},
): Promise<T | string | null> {
  const legacy = readLegacy(key, legacySessionKey);
  if (legacy === null) return readImport<T>(key);
  try {
    const b = await backend();
    if (b.kind === "localstorage") return legacy;
    await b.set(key, legacy);
    if (b.kind === "indexeddb") removeLegacy(key, legacySessionKey);
  } catch {
    // keep the legacy copy where it is
  }
  return legacy;
}

/** Call `listener` with the key whenever another tab writes or removes an import. Returns an unsubscribe. */
export function subscribeImports(listener: (key: string) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMessage = (event: MessageEvent) => {
    const key = (event.data as { key?: unknown } | null)?.key;
    if (typeof key === "string") listener(key);
  };
  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}
