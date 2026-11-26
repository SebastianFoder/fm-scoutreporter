"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "../i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Columns3, GitCompareArrows, SlidersHorizontal } from "lucide-react";
import PlayersListClient from "@scoutreporter/ui/features/attribute/players/PlayerListClient";
import { useActiveWeightProfile } from "./WeightConfig";
import { Button } from "./Button";
import { usePlayersData } from "./PlayersDataProvider";
import { useSquadData } from "./SquadDataProvider";
import { useStoredToggle } from "./useStoredToggle";
import { useSettings } from "./Settings";
import { CsvImportPanel } from "./CsvImportPanel";
import { PageHeader } from "./PageHeader";
import { NoImport } from "./ImportPanel";
import { useProfileName } from "../i18n/hooks";

export default function AttributeModeHome() {
  const { state } = usePlayersData();
  // Your own players are the ones in your squad import: your club from a scan, or your squad CSV.
  const { state: squadState } = useSquadData();
  const squadIds = useMemo(() => new Set(squadState.players.map((p) => p.raw.uniqueId)), [squadState.players]);
  const mine = useMemo(() => state.players.filter((p) => squadIds.has(p.raw.uniqueId)).length, [state.players, squadIds]);
  const [showMine, setShowMine] = useStoredToggle("playersShowMyClub", true);
  const shown = useMemo(
    () => (showMine || mine === 0 ? state.players : state.players.filter((p) => !squadIds.has(p.raw.uniqueId))),
    [state.players, showMine, mine, squadIds],
  );
  const players = state.players.length > 0 ? shown : null;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Weights and Columns live in Settings; these buttons open it at their tab.
  const { openSettings } = useSettings();
  const router = useRouter();
  const weightProfile = useActiveWeightProfile();
  const t = useTranslations("players");
  const tFm = useTranslations("fm");
  const profileName = useProfileName();

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader
          title={tFm("terms.players")}
          aside={
            <Link href="/players/best-xi" className="btn h-9 border border-line bg-surface px-3 text-sm hover:bg-paper">
              {tFm("terms.bestXi")} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        >
          {t("home.intro")}
        </PageHeader>

        <CsvImportPanel testFixture="attribute-fm27-hidden" onImported={() => setSelectedIds([])} />

        {players && players.length > 0 && (
          <section aria-label={tFm("terms.players")} className="panel">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted">
                {t.rich("home.scoredWith", {
                  profile: profileName(weightProfile),
                  link: (chunks) => (
                    <button type="button" onClick={() => openSettings("weights")} className="link">
                      {chunks}
                    </button>
                  ),
                })}
                {selectedIds.length > 0 && (
                  <>
                    {" "}
                    · <span className="font-semibold text-ink">{t("selectedCount", { count: selectedIds.length })}</span>
                  </>
                )}
              </p>
              {mine > 0 && (
                <label className="flex items-center gap-2 text-sm md:mr-auto md:ml-4" title={t("home.myPlayersTitle")}>
                  <input
                    type="checkbox"
                    checked={showMine}
                    onChange={(e) => setShowMine(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  {t("home.showMyPlayers", { count: mine })}
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  color="alt"
                  variant="outline"
                  size="md"
                  onClick={() => openSettings("weights")}
                  icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
                >
                  {t("home.weights")}
                </Button>
                <Button
                  color="alt"
                  variant="outline"
                  size="md"
                  onClick={() => openSettings("columns")}
                  icon={<Columns3 className="h-4 w-4" aria-hidden />}
                >
                  {t("home.columns")}
                </Button>
                <Button
                  color="primary"
                  variant="solid"
                  size="md"
                  disabled={selectedIds.length < 2}
                  icon={<GitCompareArrows className="h-4 w-4" aria-hidden />}
                  onClick={() => {
                    if (selectedIds.length < 2) return;
                    router.push(`/players/compare?ids=${encodeURIComponent(selectedIds.join(","))}`);
                  }}
                >
                  {t("home.compareSelected", { count: selectedIds.length })}
                </Button>
              </div>
            </div>
            <PlayersListClient
              players={players}
              selectable
              selectedIds={selectedIds}
              onToggleSelect={(id) =>
                setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
            />
          </section>
        )}

        {!players && (
          <NoImport
            desktop={t.rich("home.emptyDesktop", {
              kbd: (chunks) => (
                <kbd className="rounded border border-line bg-surface px-1.5 text-[12px] font-semibold text-ink">{chunks}</kbd>
              ),
            })}
          >
            {t("home.empty")}
          </NoImport>
        )}
      </main>
    </div>
  );
}
