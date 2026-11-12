import { Suspense } from "react";
import PlayersPageClient from "@scoutreporter/ui/features/attribute/players/PlayersPageClient";

export default function AttributePlayersPage() {
  return (
    <Suspense fallback={null}>
      <PlayersPageClient />
    </Suspense>
  );
}
