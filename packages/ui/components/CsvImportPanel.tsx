"use client";

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

  return (
    <ImportPanel
      title={count > 0 ? `${count} players imported` : "Import player CSV"}
      description={
        <>
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
        </>
      }
      testFixture={testFixture}
      onLoad={async (text) => ((await setCsvText(text)) ? null : STORAGE_FULL_MESSAGE)}
      onClear={clear}
      onImported={onImported}
    />
  );
}
