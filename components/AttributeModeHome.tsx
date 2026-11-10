"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayersListClient from "@/features/attribute/players/PlayerListClient";
import { WeightConfigModal } from "./WeightConfig";
import { Button } from "./Button";
import { usePlayersData } from "./PlayersDataProvider";
import { HighlightConfigModal } from "./HighlightedAttributesConfig";
import { CsvImportPanel } from "./CsvImportPanel";

export default function AttributeModeHome() {
  const { state } = usePlayersData();
  const players = state.players.length > 0 ? state.players : null;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[oklch(var(--background))] text-[oklch(var(--text))]">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tight">
            Scout Reporter
          </h1>
          <p className="max-w-2xl text-sm text-[oklch(var(--text))/0.75]">
            Import a player export CSV to score and explore players. FM27 role
            profiles (benchmarked by fm-scoring) are included under Weights.
          </p>
        </header>

        <CsvImportPanel testFixture="attribute" onImported={() => setSelectedIds([])} />

        {players && players.length > 0 && (
          <>
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-sm font-bold text-[oklch(var(--text))]">
                {players.length} players loaded
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  color="alt"
                  variant="solid"
                  size="md"
                  onClick={() => setWeightsOpen(true)}
                >
                  Weights
                </Button>
                <Button
                  color="alt"
                  variant="outline"
                  size="md"
                  onClick={() => setHighlightsOpen(true)}
                >
                  Columns
                </Button>

                <Button
                  color="primary"
                  variant="solid"
                  size="md"
                  disabled={selectedIds.length < 2}
                  onClick={() => {
                    if (selectedIds.length < 2) return;
                    const ids = selectedIds.join(",");
                    router.push(`/attribute/compare?ids=${encodeURIComponent(ids)}`);
                  }}
                >
                  Compare selected ({selectedIds.length})
                </Button>
              </div>
            </section>

            <section className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] shadow-[4px_4px_0_oklch(var(--border))]">
              <PlayersListClient
                players={players}
                selectable
                selectedIds={selectedIds}
                onToggleSelect={(id) =>
                  setSelectedIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id],
                  )
                }
              />
            </section>
          </>
        )}

        {!players && (
          <p className="text-sm font-bold text-[oklch(var(--text))/0.6]">
            No CSV imported yet. Use the button above to load players.
          </p>
        )}
      </main>

      <WeightConfigModal
        open={weightsOpen}
        onClose={() => setWeightsOpen(false)}
      />
      <HighlightConfigModal
        open={highlightsOpen}
        onClose={() => setHighlightsOpen(false)}
      />
    </div>
  );
}
