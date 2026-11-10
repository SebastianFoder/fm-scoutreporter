import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fixturePlayers } from "../../../.storybook/fixtures";
import CompareClient from "./CompareClient";

const players = fixturePlayers("fm27outfield");
const idsOf = (n: number) => players.slice(0, n).map((p) => p.raw.uniqueId);

const meta = {
  title: "Features/Attribute/Compare",
  component: CompareClient,
  parameters: { layout: "fullscreen" },
  argTypes: { players: { control: false } },
  args: { players },
} satisfies Meta<typeof CompareClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingSelected: Story = {};

export const TwoPlayers: Story = {
  args: { initialSelectedIds: idsOf(2) },
};

export const FourPlayers: Story = {
  args: { initialSelectedIds: idsOf(4) },
};
