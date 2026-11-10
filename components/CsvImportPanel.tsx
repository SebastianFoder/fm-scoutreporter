"use client";

import { useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { Button, LINK_BUTTON_CLASS } from "./Button";
import { usePlayersData } from "./PlayersDataProvider";
import { VIEW_HIDDEN, VIEW_STANDARD } from "@/lib/view-files";

/** CSV import + view download, shared by Attribute and Wonderkid mode (both use the same imported data). */
export function CsvImportPanel({
  testFixture = "attribute",
  onImported,
}: {
  /** Fixture name served by /api/fixtures/[name]. */
  testFixture?: string;
  onImported?: () => void;
}) {
  const { state, setCsvText, clear } = usePlayersData();
  const [error, setError] = useState<string | null>(null);
  const [testDataLoading, setTestDataLoading] = useState(false);
  const count = state.players.length;

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
    <section aria-label="Import" className="panel">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="section-title">
            {count > 0 ? `${count} players imported` : "Import player CSV"}
          </h2>
          <p className="text-[13px] text-muted">
            FM26 (<code>;</code>) or FM27 (<code>,</code>) export of the Scout Reporter view.
            Columns are matched by name. View file:{" "}
            <a href={VIEW_STANDARD.href} className="link">
              Standard
            </a>{" "}
            or{" "}
            <a href={VIEW_HIDDEN.href} className="link">
              Hidden Attributes
            </a>{" "}
            (adds Professionalism, CA, PA).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            color="alt"
            variant="ghost"
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
          <label
            className={`${LINK_BUTTON_CLASS} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-series-1`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />
            <Upload className="h-4 w-4" aria-hidden />
            <span>Choose CSV file</span>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-line bg-red/8 px-4 py-2.5 text-sm text-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red" aria-hidden />
          {error}
        </div>
      )}
    </section>
  );
}
