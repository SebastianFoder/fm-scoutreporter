import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AttributeModeHome from "./AttributeModeHome";

const meta = {
  title: "Pages/Players",
  component: AttributeModeHome,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/players" } },
  },
} satisfies Meta<typeof AttributeModeHome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

export const FM26Import: Story = {
  parameters: { appProviders: { players: "fm26" } },
};

export const FM27V2Import: Story = {
  parameters: { appProviders: { players: "fm27hidden" } },
};

/** A whole squad with hidden attributes, every position (used for the README screenshots). */
export const SquadImport: Story = {
  parameters: { appProviders: { players: "squadHidden" } },
};

/** The Wonderkids view: prospects ranked at full potential (used for the README screenshots). */
export const Wonderkids: Story = {
  parameters: {
    appProviders: { players: "squadHidden" },
    nextjs: { navigation: { pathname: "/players", query: { view: "wonderkids" } } },
  },
};

/** Wonderkids on a standard view export: no CA/PA, so no potential estimates. */
export const WonderkidsWithoutCaPa: Story = {
  parameters: {
    appProviders: { players: "fm26" },
    nextjs: { navigation: { pathname: "/players", query: { view: "wonderkids" } } },
  },
};
