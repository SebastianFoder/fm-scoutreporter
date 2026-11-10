import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fixturePlayer } from "../../../.storybook/fixtures";
import { groupPlayerAttributes } from "../../../lib/parser/attribute-grouper";
import { PlayerAttributesClient } from "./PlayerAttributesClient";

const outfield = fixturePlayer("fm27outfield");
// The only fixture with CA/PA (and so potential projections) is all goalkeepers.
const keeper = fixturePlayer("fm27v2", (p) => !!p.potential);

const meta = {
  title: "Features/Attribute/PlayerAttributes",
  component: PlayerAttributesClient,
  argTypes: { grouped: { control: false }, baseline: { control: false } },
  args: { grouped: outfield.grouped, isGoalkeeper: false },
} satisfies Meta<typeof PlayerAttributesClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outfield: Story = {};

export const Goalkeeper: Story = {
  args: { grouped: keeper.grouped, isGoalkeeper: true },
};

/** Projected attributes at PA, with gains over current shown as deltas. */
export const FullPotential: Story = {
  args: {
    grouped: groupPlayerAttributes({ ...keeper.raw, ...keeper.potential!.attributes }),
    baseline: keeper.grouped,
    isGoalkeeper: true,
  },
};

/** Colour bands follow the active AttributeColorConfig profile. */
export const StrictColourBands: Story = {
  parameters: {
    appProviders: {
      storage: {
        attributeColors: {
          activeId: "strict",
          profiles: [
            { id: "strict", name: "Strict", thresholds: { excellent: 18, good: 15, average: 10 } },
          ],
        },
      },
    },
  },
};
