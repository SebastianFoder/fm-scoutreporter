"use client";

import { useTranslations } from "next-intl";
import { ImportPanel, STORAGE_FULL_MESSAGE } from "@scoutreporter/ui/components/ImportPanel";
import { useStaffData } from "@scoutreporter/ui/components/StaffDataProvider";
import { VIEW_STAFF } from "@scoutreporter/core/view-files";

/** Staff CSV import, shared by the staff list and Best backroom. */
export function StaffImportPanel({ onImported }: { onImported?: () => void }) {
  const { state, importCsv, clear } = useStaffData();
  const count = state.staff.length;
  const t = useTranslations("importer.staff");

  return (
    <ImportPanel
      title={count > 0 ? t("imported", { count }) : t("title")}
      description={t.rich("description", {
        link: (chunks) => (
          <a href={VIEW_STAFF.href} className="link">
            {chunks}
          </a>
        ),
      })}
      testFixture="staff"
      onLoad={async (text) => {
        const r = await importCsv(text);
        if (!r.ok) return r.error;
        return r.persisted ? null : STORAGE_FULL_MESSAGE;
      }}
      onClear={clear}
      onImported={onImported}
    />
  );
}
