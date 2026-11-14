"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Columns3, GitCompareArrows, SlidersHorizontal } from "lucide-react";
import PlayersListClient from "@scoutreporter/ui/features/attribute/players/PlayerListClient";
import { WeightConfigModal, useActiveWeightProfile } from "./WeightConfig";
import { Button } from "./Button";
import { usePlayersData } from "./PlayersDataProvider";
import { HighlightConfigModal } from "./HighlightedAttributesConfig";
import { CsvImportPanel } from "./CsvImportPanel";
import { PageHeader } from "./PageHeader";
import { NoImport } from "./ImportPanel";

export default function AttributeModeHome() {
  const { state } = usePlayersData();
  const players = state.players.length > 0 ? state.players : null;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const router = useRouter();
  const weightProfile = useActiveWeightProfile();

  return (
    <div className="text-ink">
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader
          title="Players"
          aside={
            <Link href="/players/best-xi" className="btn h-9 border border-line bg-surface px-3 text-sm hover:bg-paper">
              Best XI <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        >
          Score, rank and compare players. With CA and PA (a scan, or a Hidden Attributes export),
          Potential and vs Age find the wonderkids: sort by Potential to see who could become the best. FM27
          role profiles (benchmarked by fm-scoring) are included under Weights.
        </PageHeader>

        <CsvImportPanel testFixture="attribute-fm27-hidden" onImported={() => setSelectedIds([])} />

        {players && players.length > 0 && (
          <section aria-label="Players" className="panel">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
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
          <NoImport desktop={<>No players yet. In FM, open a Player Search and press <kbd className="rounded border border-line bg-surface px-1.5 text-[12px] font-semibold text-ink">F9</kbd> or Scan search.</>}>
            No CSV imported yet. Choose a CSV file above, or load the test data to look around.
          </NoImport>
        )}
      </main>

      <WeightConfigModal open={weightsOpen} onClose={() => setWeightsOpen(false)} />
      <HighlightConfigModal open={highlightsOpen} onClose={() => setHighlightsOpen(false)} />
    </div>
  );
}
