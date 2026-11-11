import type { Decorator } from "@storybook/nextjs-vite";
import { useState, type ReactNode } from "react";
import { AttributeColorProvider } from "../components/AttributeColorConfig";
import { HighlightedAttributesProvider } from "../components/HighlightedAttributesConfig";
import { PlayersDataProvider } from "../components/PlayersDataProvider";
import { StaffDataProvider } from "../components/StaffDataProvider";
import { WeightProvider } from "../components/WeightConfig";
import { API_FIXTURES, FIXTURE_CSV, STAFF_FIXTURE_CSV, type FixtureName } from "./fixtures";

/** localStorage keys owned by the app's providers. */
const STORAGE_KEYS = {
  players: "importedPlayersCsv",
  staff: "importedStaffCsv",
  weights: "weightProfiles",
  highlights: "highlightProfiles",
  attributeColors: "attributeColorProfiles",
  bestXi: "bestXiSettings",
  bestBackroom: "bestBackroomSettings",
} as const;

export type AppStorageKey = keyof typeof STORAGE_KEYS;

export interface AppProvidersParameters {
  /** Fixture to pre-import into PlayersDataProvider; `null` starts with no import. Default `null`. */
  players?: FixtureName | null;
  /** Pre-import the staff fixture into StaffDataProvider. Default `false`. */
  staff?: boolean;
  /** Raw values (JSON-serialisable) to seed into the other providers' storage. */
  storage?: Partial<Record<Exclude<AppStorageKey, "players" | "staff">, unknown>>;
  /** Set to `true` to skip wrapping (for pure presentational stories). */
  disable?: boolean;
}

/**
 * The app's providers persist to localStorage and hydrate from it on mount, so seeding
 * storage before they mount is how a story controls their state. Every story starts from
 * a clean slate so one story's edits (e.g. in the Weights modal) don't leak into another.
 */
function seedStorage({ players = null, staff = false, storage = {} }: AppProvidersParameters) {
  try {
    for (const key of Object.values(STORAGE_KEYS)) window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(STORAGE_KEYS.players);
    if (players) window.localStorage.setItem(STORAGE_KEYS.players, FIXTURE_CSV[players]);
    if (staff) window.localStorage.setItem(STORAGE_KEYS.staff, STAFF_FIXTURE_CSV);
    for (const [k, v] of Object.entries(storage)) {
      if (v !== undefined) {
        window.localStorage.setItem(STORAGE_KEYS[k as AppStorageKey], JSON.stringify(v));
      }
    }
  } catch {
    // storage blocked: providers fall back to their defaults
  }
}

function AppProviders({
  config,
  children,
}: {
  config: AppProvidersParameters;
  children: ReactNode;
}) {
  // Seed exactly once per mount (the decorator keys this component by story id).
  useState(() => seedStorage(config));

  return (
    <AttributeColorProvider>
      <WeightProvider>
        <PlayersDataProvider>
          <StaffDataProvider>
            <HighlightedAttributesProvider>{children}</HighlightedAttributesProvider>
          </StaffDataProvider>
        </PlayersDataProvider>
      </WeightProvider>
    </AttributeColorProvider>
  );
}

/** Wraps stories in the same provider stack as `app/layout.tsx`. Configure via `parameters.appProviders`. */
export const withAppProviders: Decorator = (Story, context) => {
  const config: AppProvidersParameters = context.parameters.appProviders ?? {};
  if (config.disable) return <Story />;
  return (
    <AppProviders key={context.id} config={config}>
      <Story />
    </AppProviders>
  );
};

/**
 * Serve the app's `/api/fixtures/[name]` route from the bundled fixtures, so the
 * "Load test data" button works in Storybook (dev and static builds alike).
 */
export function installFixtureFetchMock() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __fixtureFetchMock?: boolean };
  if (w.__fixtureFetchMock) return;
  w.__fixtureFetchMock = true;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.href,
    );
    const match = url.pathname.match(/^\/api\/fixtures\/([^/]+)$/);
    if (match) {
      const csv = API_FIXTURES[decodeURIComponent(match[1])];
      return csv !== undefined
        ? new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } })
        : new Response("Not found", { status: 404 });
    }
    return realFetch(input, init);
  };
}
