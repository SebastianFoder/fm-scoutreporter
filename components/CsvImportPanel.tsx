"use client";

import { useState } from "react";
import { Button } from "./Button";
import { usePlayersData } from "./PlayersDataProvider";

export const VIEW_V1_HREF = "/SCOUT%20REPORTER%20Attributes%20v1.fmf";
export const VIEW_V2_HREF = "/SCOUT%20REPORTER%20Attributes%20v2.fmf";

const LINK_BUTTON =
  "inline-flex items-center rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--primary))] px-4 py-2 text-sm font-bold text-[oklch(var(--background))] shadow-[2px_2px_0_oklch(var(--border))] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_oklch(var(--border))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

/** CSV import + view download, shared by Attribute and Wonderkid mode (both use the same imported data). */
export function CsvImportPanel({
  testFixture = "attribute",
  onImported,
}: {
  /** Fixture name served by /api/fixtures/[name]. */
  testFixture?: string;
  onImported?: () => void;
}) {
  const { setCsvText, clear } = usePlayersData();
  const [error, setError] = useState<string | null>(null);
  const [testDataLoading, setTestDataLoading] = useState(false);

  const load = (text: string) => {
    const persisted = setCsvText(text);
    onImported?.();
    setError(
      persisted
        ? null
        : "Import loaded in this tab only: browser storage is full or blocked. Free space or allow storage to keep data across tabs and visits.",
    );
  };

  const loadTestData = async () => {
    setTestDataLoading(true);
    try {
      const res = await fetch(`/api/fixtures/${testFixture}`);
      if (!res.ok) throw new Error("Failed to fetch fixture");
      load(await res.text());
    } catch {
      setError("Could not load test data.");
    } finally {
      setTestDataLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      load(await file.text());
    } catch (e) {
      console.error(e);
      setError("Could not parse CSV. Please check the file format.");
      clear();
    } finally {
      event.target.value = "";
    }
  };

  return (
    <>
      <section className="flex flex-col items-start gap-4 rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-6 py-5 shadow-[4px_4px_0_oklch(var(--border))] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide">Import player CSV</p>
          <p className="text-xs text-[oklch(var(--text))/0.65]">
            FM26 (<code>;</code>) or FM27 (<code>,</code>) export of the Scout Reporter view. Columns
            are matched by name.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            color="alt"
            variant="outline"
            size="md"
            onClick={() => {
              clear();
              onImported?.();
              setError(null);
            }}
          >
            Clear import
          </Button>
          <Button
            color="alt"
            variant="outline"
            size="md"
            onClick={() => void loadTestData()}
            disabled={testDataLoading}
          >
            {testDataLoading ? "Loading…" : "Load test data"}
          </Button>
          <label className={`${LINK_BUTTON} cursor-pointer gap-2 px-5 py-2.5`}>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <span>Choose CSV file</span>
          </label>
        </div>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-6 py-5 shadow-[4px_4px_0_oklch(var(--border))] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide">Attribute view (.fmf)</p>
          <p className="text-xs text-[oklch(var(--text))/0.65]">
            Import a view in FM before exporting. v2 adds Professionalism, CA and PA, which
            unlock full-potential estimates and Wonderkid mode.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={VIEW_V2_HREF} className={LINK_BUTTON}>
            Download v2 view
          </a>
          <a
            href={VIEW_V1_HREF}
            className="inline-flex items-center rounded-lg border-2 border-[oklch(var(--border))] px-4 py-2 text-sm font-bold shadow-[2px_2px_0_oklch(var(--border))]"
          >
            v1 view
          </a>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border-2 border-[oklch(var(--red-bg))] bg-[oklch(var(--red-bg))/0.1] px-4 py-3 text-sm font-bold text-[oklch(var(--red-bg))]">
          {error}
        </div>
      )}
    </>
  );
}
