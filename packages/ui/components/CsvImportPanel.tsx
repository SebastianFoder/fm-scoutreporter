"use client";

import { useTranslations } from "next-intl";
import { ImportPanel, STORAGE_FULL_MESSAGE } from "./ImportPanel";
import { usePlayersData } from "./PlayersDataProvider";
import { VIEW_HIDDEN, VIEW_STANDARD } from "@scoutreporter/core/view-files";

/** CSV import + view download, shared by Players and Best XI (both use the same imported data). */
export function CsvImportPanel({
  testFixture = "attribute",
  onImported,
}: {
  /** Fixture name served by /api/fixtures/[name]. */
  testFixture?: string;
  onImported?: () => void;
}) {
  const { state, setCsvText, clear } = usePlayersData();
  const count = state.players.length;
  const t = useTranslations("importer.players");
  const tAttributes = useTranslations("fm.attributes");

  return (
    <ImportPanel
      title={count > 0 ? t("imported", { count }) : t("title")}
      description={t.rich("description", {
        professionalism: tAttributes("professionalism"),
        code: (chunks) => <code>{chunks}</code>,
        standard: (chunks) => (
          <a href={VIEW_STANDARD.href} className="link">
            {chunks}
          </a>
        ),
        hidden: (chunks) => (
          <a href={VIEW_HIDDEN.href} className="link">
            {chunks}
          </a>
        ),
      })}
      testFixture={testFixture}
      onLoad={async (text) => ((await setCsvText(text)) ? null : STORAGE_FULL_MESSAGE)}
      onClear={clear}
      onImported={onImported}
    />
  );
}
