import Link from "next/link";
import { PlayerLink } from "@scoutreporter/ui/components/PlayerPanel";
import { GradeStamp } from "@scoutreporter/ui/components/GradeStamp";
import type { PlayerWithGroups } from "@scoutreporter/ui/components/PlayersDataProvider";
import { SLOT_LABEL } from "@scoutreporter/core/best-xi/formations";
import type { SlotSetting } from "@scoutreporter/core/best-xi/roles";
import type { Upgrade } from "@scoutreporter/core/squad/analysis";
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

  return (
    <section aria-labelledby="squad-upgrades" className="panel">
      <div className="border-b border-line px-4 py-3">
        <h2 id="squad-upgrades" className="section-title">
          Upgrades from your scouting import
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {upgrades
            ? "Scouted players at least 0.5 better than your weakest starter at each position, on the same role."
            : scoutingCount > 0
              ? "Everyone in your player import is already in the squad."
              : "Who in your scouting list would improve the eleven."}
        </p>
      </div>
      {!upgrades ? (
        scoutingCount === 0 && (
          <p className="px-4 py-4 text-sm text-muted">
            Import a scouting export (a player search) in{" "}
            <Link href="/attribute" className="link">
              Attribute mode
            </Link>{" "}
            to see who would improve each position.
          </p>
        )
      ) : (
        <>
          {withCandidates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Pos</th>
                    <th className="px-3 py-2 text-left">Your starter</th>
                    <th className="px-3 py-2 text-left">Best scouted upgrades</th>
                  </tr>
                </thead>
                <tbody>
                  {withCandidates.map((u) => (
                    <tr key={u.key}>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold">
                        {SLOT_LABEL[slots[u.indices[0]].slot]}
                        {u.indices.length > 1 && <span className="font-normal text-muted"> ×{u.indices.length}</span>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {u.starter ? (
                          <PlayerChip name={name(u.starter.id)} score={u.starter.score} />
                        ) : (
                          <span className="text-[13px] font-semibold text-red">Nobody</span>
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
                                <span className="text-[12px] text-muted">{raw?.age}y</span>
                                <span className="tabular-nums text-muted">{c.score.toFixed(1)}</span>
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
              No upgrade in your import for{" "}
              {without.map((u) => SLOT_LABEL[slots[u.indices[0]].slot]).join(", ")}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
