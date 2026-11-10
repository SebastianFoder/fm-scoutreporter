import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fixturePlayer, isOutfield } from "../../.storybook/fixtures";
import { Fm27RolePanel } from "./Fm27RolePanel";

const meta = {
  title: "Features/FM27/RolePanel",
  component: Fm27RolePanel,
  parameters: { appProviders: { disable: true } },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  argTypes: { player: { control: false } },
} satisfies Meta<typeof Fm27RolePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** FM27 outfield player without CA/PA: current scores only. */
export const Outfield: Story = {
  args: { player: fixturePlayer("fm27outfield") },
};

/** v2 export (CA/PA): adds the potential column and "Potential vs prime". */
export const WithPotential: Story = {
  args: { player: fixturePlayer("fm27v2", (p) => !!p.potential) },
};

export const FM26Outfield: Story = {
  args: { player: fixturePlayer("fm26", isOutfield) },
};
