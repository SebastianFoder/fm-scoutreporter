import Link from "next/link";
import { useTranslations } from "next-intl";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import type { PlayerWithGroups } from "@scoutreporter/ui/components/PlayersDataProvider";
import { SLOT_LABEL } from "@scoutreporter/core/best-xi/formations";
import type { SlotSetting } from "@scoutreporter/core/best-xi/roles";
import type { Upgrade } from "@scoutreporter/core/squad/analysis";
import { useFixed } from "@scoutreporter/ui/features/best-xi/PitchLineup";
import { Delta, PlayerChip } from "./SquadBits";

/** Scouted players (the player import) who would beat the weakest starter at each position. */
export function SquadUpgrades({
  upgrades,
  slots,
  name,
  scoutById,
  scoutingCount,
}: {
  upgrades: Upgrade[] | null;
  slots: SlotSetting[];
  name: (id: string) => string;
  scoutById: Map<string, PlayerWithGroups>;
  scoutingCount: number;
}) {
  const withCandidates = upgrades?.filter((u) => u.candidates.length > 0) ?? [];
  const without = upgrades?.filter((u) => u.candidates.length === 0) ?? [];
  const t = useTranslations("squad");
  const fixed = useFixed();

  return (
    <section aria-labelledby="squad-upgrades" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="squad-upgrades" className="section-title">
          {t("upgrades.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {upgrades
            ? t("upgrades.intro")
            : scoutingCount > 0
              ? t("upgrades.allInSquad")
              : t("upgrades.teaser")}
        </p>
      </div>
      {!upgrades ? (
        scoutingCount === 0 && (
          <p className="px-4 py-4 text-sm text-muted">
            {t.rich("upgrades.importHint", {
              link: (chunks) => (
                <Link href="/players" className="link">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )
      ) : (
        <>
          {withCandidates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">{t("upgrades.columns.pos")}</th>
                    <th className="px-3 py-2 text-left">{t("upgrades.columns.starter")}</th>
                    <th className="px-3 py-2 text-left">{t("upgrades.columns.best")}</th>
                  </tr>
                </thead>
                <tbody>
                  {withCandidates.map((u) => (
                    <tr key={u.key}>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold">
                        {SLOT_LABEL[slots[u.indices[0]].slot]}
                        {u.indices.length > 1 && <span className="font-normal text-muted"> {t("upgrades.times", { count: u.indices.length })}</span>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {u.starter ? (
                          <PlayerChip name={name(u.starter.id)} score={u.starter.score} />
                        ) : (
                          <span className="text-[13px] font-semibold text-red">{t("nobody")}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <ul className="flex flex-col gap-1">
                          {u.candidates.map((c) => {
                            const raw = scoutById.get(c.id)?.raw;
                            return (
                              <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                                <GradeStamp score={c.score} label={raw?.player} />
                                <PlayerLink id={c.id} className="font-semibold hover:text-accent hover:underline">
                                  {raw?.player}
                                </PlayerLink>
                                {raw && <span className="text-[12px] text-muted">{t("ageShort", { age: raw.age })}</span>}
                                <span className="tabular-nums text-muted">{fixed(c.score)}</span>
                                {u.starter && <Delta value={c.score - u.starter.score} />}
                                {raw?.transferValueRange && (
                                  <span className="text-[13px] text-muted">{raw.transferValueRange}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {without.length > 0 && (
            <p className="border-t border-line px-4 py-2.5 text-[13px] text-muted">
              {t("upgrades.none", { positions: without.map((u) => SLOT_LABEL[slots[u.indices[0]].slot]).join(", ") })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
