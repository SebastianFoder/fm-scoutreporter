"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Upload } from "lucide-react";
import { Button, LINK_BUTTON_CLASS } from "./Button";
import { DESKTOP_BUILD } from "../desktop/target";

/**
 * A message the import panel shows after a load: a key in importer.messages, translated where it is
 * shown. Providers return these instead of English text.
 */
export type ImportMessage =
  | "storageFull"
  | "testDataFailed"
  | "parseFailed"
  | "noStaffColumns"
  | "noSquadPlayers"
  | "noScanSquad";

/**
 * CSV import row: title, one-line help, and Clear / Load test data / Choose file. The data side
 * (parsing, storage) belongs to the caller: `onLoad` returns a message to show, or null when all went well.
 * Not shown in the desktop app, where the data comes from scanning FM.
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
  /** Resolves (or returns) a message to show, or null when the import went well. */
  onLoad: (csvText: string) => ImportMessage | null | Promise<ImportMessage | null>;
  onClear: () => void;
  onImported?: () => void;
}) {
  const t = useTranslations("importer");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<ImportMessage | null>(null);
  const [testDataLoading, setTestDataLoading] = useState(false);

  const load = async (text: string) => {
    setError(await onLoad(text));
    onImported?.();
  };

  const loadTestData = async () => {
    setTestDataLoading(true);
    try {
      const res = await fetch(`/api/fixtures/${testFixture}`);
      if (!res.ok) throw new Error("Failed to fetch fixture");
      await load(await res.text());
    } catch {
      setError("testDataFailed");
    } finally {
      setTestDataLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await load(await file.text());
    } catch (e) {
      console.error(e);
      setError("parseFailed");
      onClear();
    } finally {
      event.target.value = "";
    }
  };

  if (DESKTOP_BUILD) return null;

  return (
    <section aria-label={t("panel.label")} className="panel">
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
            {t("panel.clear")}
          </Button>
          <Button
            color="alt"
            variant="outline"
            size="md"
            onClick={() => void loadTestData()}
            disabled={testDataLoading}
          >
            {testDataLoading ? tCommon("loading") : t("panel.loadTestData")}
          </Button>
          <label
            className={`${LINK_BUTTON_CLASS} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-series-1`}
          >
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
            <Upload className="h-4 w-4" aria-hidden />
            <span>{t("panel.chooseFile")}</span>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-line bg-red/8 px-4 py-2.5 text-sm text-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red" aria-hidden />
          {t(`messages.${error}`)}
        </div>
      )}
    </section>
  );
}

/** Shown when an import could not be stored beyond this tab (storage full or blocked). */
export const STORAGE_FULL_MESSAGE: ImportMessage = "storageFull";

/**
 * What a screen shows before there is any data: how to import a CSV on the website, or how to scan
 * in the desktop app (which has no import panel).
 */
export function NoImport({ children, desktop }: { children: ReactNode; desktop: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
      {DESKTOP_BUILD ? desktop : children}
    </div>
  );
}
