"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import CompareClient from "./CompareClient";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";

export default function ComparePageClient() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const initialSelectedIds = useMemo(
    () => (idsParam ? idsParam.split(",").filter(Boolean) : []),
    [idsParam],
  );

  const { state } = usePlayersData();
  const players = state.players;

  return (
    <CompareClient players={players} initialSelectedIds={initialSelectedIds} />
  );
}

