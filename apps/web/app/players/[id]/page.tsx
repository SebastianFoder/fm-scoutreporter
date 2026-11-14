"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { PlayerProfile } from "@scoutreporter/ui/features/attribute/players/PlayerProfile";

export default function AttributePlayerPage() {
  const { state } = usePlayersData();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const player = useMemo(() => state.players.find((p) => p.raw.uniqueId === id), [state.players, id]);

  if (!player) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 px-5 py-10 text-ink">
        <h1 className="text-[1.6rem] font-bold">Player not found</h1>
        <p className="text-sm text-muted">
          This player isn&apos;t in the currently imported dataset. Import a CSV on{" "}
          <Link href="/players" className="link">
            the Players page
          </Link>{" "}
          and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-5 py-5 text-ink md:py-6">
      <Link href="/players" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Players
      </Link>
      <PlayerProfile player={player} />
    </div>
  );
}
