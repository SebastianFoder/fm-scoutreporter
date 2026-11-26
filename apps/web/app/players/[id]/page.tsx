"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePlayersData } from "@scoutreporter/ui/components/PlayersDataProvider";
import { PlayerProfile } from "@scoutreporter/ui/features/attribute/players/PlayerProfile";

export default function AttributePlayerPage() {
  const { state } = usePlayersData();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const t = useTranslations("players.notFound");
  const tFm = useTranslations("fm");
  const player = useMemo(() => state.players.find((p) => p.raw.uniqueId === id), [state.players, id]);

  if (!player) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 px-5 py-10 text-ink">
        <h1 className="text-[1.6rem] font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">
          {t.rich("body", {
            link: (chunks) => (
              <Link href="/players" className="link">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-5 py-5 text-ink md:py-6">
      <Link href="/players" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {tFm("terms.players")}
      </Link>
      <PlayerProfile player={player} />
    </div>
  );
}
