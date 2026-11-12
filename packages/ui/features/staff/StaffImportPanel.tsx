"use client";

import { ImportPanel, STORAGE_FULL_MESSAGE } from "@scoutreporter/ui/components/ImportPanel";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { VIEW_STAFF } from "@scoutreporter/core/view-files";

/** Staff CSV import, shared by the staff list and Best backroom. */
export function StaffImportPanel({ onImported }: { onImported?: () => void }) {
  const { state, importCsv, clear } = useStaffData();
  const count = state.staff.length;

  return (
    <ImportPanel
      title={count > 0 ? `${count} staff imported` : "Import staff CSV"}
      description={
        <>
          Export a staff search with the{" "}
          <a href={VIEW_STAFF.href} className="link">
            Scout Reporter Staff view
          </a>
          . Columns are matched by name; FM26 words and 1–20 numbers both work. Kept separate from your player
          import.
        </>
      }
      testFixture="staff"
      onLoad={(text) => {
        const r = importCsv(text);
        if (!r.ok) return r.error;
        return r.persisted ? null : STORAGE_FULL_MESSAGE;
      }}
      onClear={clear}
      onImported={onImported}
    />
  );
}
