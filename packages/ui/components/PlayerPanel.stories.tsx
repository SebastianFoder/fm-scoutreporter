import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { usePlayersData } from "./PlayersDataProvider";
import { PlayerLink, usePlayerPanel } from "./PlayerPanel";

/**
 * The player side panel. Every player name in the app is a PlayerLink: a plain click shows the
 * player here, Ctrl/Cmd-click still opens the player page. The panel is not modal, so another
 * name can be clicked while it is open.
 */
function PlayerNames({ openFirst }: { openFirst?: boolean }) {
  const { state } = usePlayersData();
  const panel = usePlayerPanel();
  const first = state.players[0]?.raw.uniqueId;
  useEffect(() => {
    if (openFirst && first) panel?.openPlayer(first);
    // Open once the import has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFirst, first]);
  if (state.players.length === 0) return <p className="text-sm text-muted">Loading players…</p>;
  return (
    <ul className="space-y-1 text-sm text-ink">
      {state.players.slice(0, 12).map((p) => (
        <li key={p.raw.uniqueId}>
          <PlayerLink id={p.raw.uniqueId} className="font-semibold hover:text-accent hover:underline">
            {p.raw.player}
          </PlayerLink>{" "}
          <span className="text-muted">{p.raw.position}</span>
        </li>
      ))}
    </ul>
  );
}

const meta = {
  title: "Components/PlayerPanel",
  component: PlayerNames,
  parameters: { layout: "padded", appProviders: { players: "fm27hidden" } },
} satisfies Meta<typeof PlayerNames>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click a name to open the panel. */
export const Closed: Story = {};

/** A Hidden Attributes export: CA, PA and the Full potential view. */
export const Open: Story = { args: { openFirst: true } };

/** A Standard export (no CA/PA). */
export const OpenStandardExport: Story = {
  args: { openFirst: true },
  parameters: { appProviders: { players: "fm26" } },
};
