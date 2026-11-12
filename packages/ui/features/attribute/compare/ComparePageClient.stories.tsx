import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fixturePlayers } from "../../../.storybook/fixtures";
import ComparePageClient from "./ComparePageClient";

const ids = fixturePlayers("fm27outfield")
  .slice(0, 3)
  .map((p) => p.raw.uniqueId)
  .join(",");

const meta = {
  title: "Pages/Compare",
  component: ComparePageClient,
  parameters: {
    layout: "fullscreen",
    appProviders: { players: "fm27outfield" },
    nextjs: { navigation: { pathname: "/attribute/compare", query: { ids } } },
  },
} satisfies Meta<typeof ComparePageClient>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Players picked from ?ids= against the imported dataset. */
export const FromUrl: Story = {};

export const NoImport: Story = {
  parameters: { appProviders: { players: null } },
};
