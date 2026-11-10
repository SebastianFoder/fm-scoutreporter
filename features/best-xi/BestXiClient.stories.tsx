import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import BestXiClient from "./BestXiClient";

const meta = {
  title: "Pages/Best XI",
  component: BestXiClient,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/best-xi" } },
  },
} satisfies Meta<typeof BestXiClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

/** Mixed-position FM26 export with one goalkeeper. */
export const Imported: Story = {
  parameters: { appProviders: { players: "fm26" } },
};

/** Outfield-only export: no goalkeeper, so the formation cannot be filled. */
export const MissingPositions: Story = {
  parameters: { appProviders: { players: "fm27outfield" } },
};
