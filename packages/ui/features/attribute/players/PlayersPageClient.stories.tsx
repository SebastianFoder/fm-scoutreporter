import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PlayersPageClient from "./PlayersPageClient";

const meta = {
  title: "Pages/Players",
  component: PlayersPageClient,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/attribute/players" } },
  },
} satisfies Meta<typeof PlayersPageClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

export const WithImport: Story = {
  parameters: { appProviders: { players: "fm27hidden" } },
};

/** A whole squad with hidden attributes, every position (used for the README screenshots). */
export const SquadImport: Story = {
  parameters: { appProviders: { players: "squadHidden" } },
};
