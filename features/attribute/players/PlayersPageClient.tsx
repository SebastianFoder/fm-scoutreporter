"use client";

import Link from "next/link";
import PlayersListClient from "./PlayerListClient";
import { usePlayersData } from "@/components/PlayersDataProvider";
import { PageHeader } from "@/components/PageHeader";

export default function PlayersPageClient() {
  const { state } = usePlayersData();
  const players = state.players;

  if (players.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 px-5 py-10 text-ink">
        <h1 className="text-[1.6rem] font-bold">Players</h1>
        <p className="text-sm text-muted">
          No players imported yet. Load a CSV on the homepage to browse and open
          profiles here.
        </p>
        <Link href="/attribute" className="link inline-flex text-sm">
          Go to import
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-5 py-6 md:py-8">
      <PageHeader title="Players" />
      <section className="panel">
        <PlayersListClient players={players} />
      </section>
    </div>
  );
}
