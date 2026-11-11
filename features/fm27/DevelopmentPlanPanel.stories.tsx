import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fixturePlayer } from "../../.storybook/fixtures";
import { DevelopmentPlanPanel } from "./DevelopmentPlanPanel";

const meta = {
  title: "Features/FM27/DevelopmentPlan",
  component: DevelopmentPlanPanel,
  parameters: { appProviders: { disable: true } },
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
  argTypes: { player: { control: false } },
} satisfies Meta<typeof DevelopmentPlanPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** FM27 outfielder without CA/PA: plan for the best role today, with session ranking. */
export const Outfield: Story = {
  args: { player: fixturePlayer("fm27outfield") },
};

/** Hidden Attributes keeper (CA/PA/Professionalism): goalkeeping focus, coaching split and CA notes. */
export const GoalkeeperWithPotential: Story = {
  args: { player: fixturePlayer("fm27hidden", (p) => !!p.potential) },
};
