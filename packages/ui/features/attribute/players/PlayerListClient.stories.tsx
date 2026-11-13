import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fixturePlayers } from "../../../.storybook/fixtures";
import PlayersListClient from "./PlayerListClient";

/**
 * Sort, search and paging live in the URL. Storybook's Next router mock records
 * router.replace calls (see the Actions panel) but does not change the URL, so each
 * state is its own story via parameters.nextjs.navigation.query.
 */
const meta = {
  title: "Features/Attribute/PlayerList",
  component: PlayersListClient,
  argTypes: { players: { control: false } },
  args: { players: fixturePlayers("fm26") },
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/attribute" } },
  },
} satisfies Meta<typeof PlayersListClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Hidden Attributes export (CA/PA) adds the Potential column. */
export const WithPotential: Story = {
  args: { players: fixturePlayers("fm27hidden") },
};

export const Selectable: Story = {
  render: function Render(args) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <PlayersListClient
        {...args}
        selectable
        selectedIds={selectedIds}
        onToggleSelect={(id) =>
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
      />
    );
  },
};

export const SortedByAgeAsc: Story = {
  parameters: {
    nextjs: { navigation: { pathname: "/attribute", query: { sort: "age", sortDir: "asc" } } },
  },
};

export const Searched: Story = {
  args: { players: fixturePlayers("fm27outfield") },
  parameters: {
    nextjs: { navigation: { pathname: "/attribute", query: { q: "an" } } },
  },
};

export const SecondPage: Story = {
  args: { players: fixturePlayers("fm27outfield") },
  parameters: {
    nextjs: { navigation: { pathname: "/attribute", query: { page: "2", pageSize: "25" } } },
  },
};

export const Empty: Story = {
  args: { players: [] },
};
