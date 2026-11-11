"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { Button, LINK_BUTTON_CLASS } from "./Button";

/**
 * CSV import row: title, one-line help, and Clear / Load test data / Choose file. The data side
 * (parsing, storage) belongs to the caller: `onLoad` returns a message to show, or null when all went well.
 */
export function ImportPanel({
  title,
  description,
  testFixture,
  onLoad,
  onClear,
  onImported,
}: {
  title: string;
  description: ReactNode;
  /** Fixture name served by /api/fixtures/[name]. */
  testFixture: string;
  onLoad: (csvText: string) => string | null;
  onClear: () => void;
  onImported?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [testDataLoading, setTestDataLoading] = useState(false);

  const load = (text: string) => {
    setError(onLoad(text));
    onImported?.();
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
      onClear();
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section aria-label="Import" className="panel">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          <p className="text-[13px] text-muted">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            color="alt"
            variant="ghost"
            size="md"
            onClick={() => {
              onClear();
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
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
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

export const STORAGE_FULL_MESSAGE =
  "Import loaded in this tab only: browser storage is full or blocked. Free space or allow storage to keep data across tabs and visits.";
