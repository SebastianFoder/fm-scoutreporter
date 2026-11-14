"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, GitCompareArrows, SlidersHorizontal } from "lucide-react";
import PlayersListClient from "@scoutreporter/ui/features/attribute/players/PlayerListClient";
import { NoCaPaNotice, WonderkidList, WonderkidMethod } from "@scoutreporter/ui/features/wonderkid/WonderkidList";
import { WeightConfigModal, useActiveWeightProfile } from "./WeightConfig";
import { Button } from "./Button";
import { usePlayersData } from "./PlayersDataProvider";
import { HighlightConfigModal } from "./HighlightedAttributesConfig";
import { CsvImportPanel } from "./CsvImportPanel";
import { PageHeader } from "./PageHeader";
import { PLAYERS_TABS, SectionTabs } from "./SectionTabs";
import { SegmentedControl } from "./SegmentedControl";

/** The Players page shows every player, or (`?view=wonderkids`) prospects ranked at full potential. */
export type PlayersView = "all" | "wonderkids";

export default function AttributeModeHome() {
  const { state } = usePlayersData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Bumped on every import, so the Wonderkids filters and page start over.
  const [imports, setImports] = useState(0);

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader title="Players">
          Import a player export CSV to score, rank and compare players, or switch to Wonderkids to rank
          prospects on their estimated attributes at full potential. FM27 role profiles (benchmarked by
          fm-scoring) are included under Weights.
        </PageHeader>
        <SectionTabs tabs={PLAYERS_TABS} label="Player screens" />

        <CsvImportPanel
          testFixture="attribute-fm27-hidden"
          onImported={() => {
            setSelectedIds([]);
            setImports((n) => n + 1);
          }}
        />

        {state.players.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            No CSV imported yet. Choose a CSV file above, or load the test data to look around. Export with the
            Hidden Attributes view (Professionalism, CA, PA) to find wonderkids too.
          </p>
        ) : (
          // The view is in the URL (useSearchParams), so it waits for the browser.
          <Suspense fallback={null}>
            <PlayersViews selectedIds={selectedIds} setSelectedIds={setSelectedIds} imports={imports} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function PlayersViews({
  selectedIds,
  setSelectedIds,
  imports,
}: {
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  imports: number;
}) {
  const { state } = usePlayersData();
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/players";
  const router = useRouter();
  const view: PlayersView = searchParams.get("view") === "wonderkids" ? "wonderkids" : "all";
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const weightProfile = useActiveWeightProfile();

  const setView = (next: PlayersView) =>
    router.replace(next === "wonderkids" ? `${pathname}?view=wonderkids` : pathname, { scroll: false });

  return (
    <>
      {view === "wonderkids" && <NoCaPaNotice />}

      <section aria-label={view === "wonderkids" ? "Wonderkids" : "Players"} className="panel">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SegmentedControl
              value={view}
              onChange={setView}
              label="Show"
              options={[
                { value: "all", label: "All players" },
                { value: "wonderkids", label: "Wonderkids" },
              ]}
            />
            {view === "all" ? (
              <p className="text-sm text-muted">
                Scored with{" "}
                <button type="button" onClick={() => setWeightsOpen(true)} className="link">
                  {weightProfile.name}
                </button>
                {selectedIds.length > 0 && (
                  <>
                    {" "}
                    · <span className="font-semibold text-ink">{selectedIds.length} selected</span>
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted">Ranked on their best FM27 role at full potential</p>
            )}
          </div>
          {view === "all" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                color="alt"
                variant="outline"
                size="md"
                onClick={() => setWeightsOpen(true)}
                icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
              >
                Weights
              </Button>
              <Button
                color="alt"
                variant="outline"
                size="md"
                onClick={() => setHighlightsOpen(true)}
                icon={<Columns3 className="h-4 w-4" aria-hidden />}
              >
                Columns
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
                Compare selected ({selectedIds.length})
              </Button>
            </div>
          )}
        </div>

        {view === "all" ? (
          <PlayersListClient
            players={state.players}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={(id) =>
              setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
          />
        ) : (
          <WonderkidList key={imports} />
        )}
      </section>

      {view === "wonderkids" && <WonderkidMethod />}

      <WeightConfigModal open={weightsOpen} onClose={() => setWeightsOpen(false)} />
      <HighlightConfigModal open={highlightsOpen} onClose={() => setHighlightsOpen(false)} />
    </>
  );
}
