import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./Button";
import { SettingsButton, useSettings, type SettingsTab } from "./Settings";

/** Opens Settings at a tab when the story loads; the button opens it again after closing. */
function OpenAt({ tab }: { tab: SettingsTab }) {
  const { openSettings } = useSettings();
  useEffect(() => openSettings(tab), [openSettings, tab]);
  return <Button onClick={() => openSettings(tab)}>Open Settings</Button>;
}

const meta = {
  title: "Config/Settings",
  component: OpenAt,
  parameters: { layout: "centered" },
  args: { tab: "weights" },
} satisfies Meta<typeof OpenAt>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First run: FM27 benchmark profiles seeded, "10" role active. */
export const Weights: Story = {};

export const WeightsCustomProfile: Story = {
  parameters: {
    appProviders: {
      storage: {
        weights: {
          activeId: "striker",
          seeded: 1,
          profiles: [
            {
              id: "striker",
              name: "Poacher",
              weights: { finishing: 20, offTheBall: 18, composure: 15, pace: 12, acceleration: 12 },
              emphasis: 2,
            },
          ],
        },
      },
    },
  },
};

export const Columns: Story = { args: { tab: "columns" } };

export const ColumnsManyProfiles: Story = {
  args: { tab: "columns" },
  parameters: {
    appProviders: {
      storage: {
        highlights: {
          activeId: "defender",
          profiles: [
            { id: "default", name: "Default", highlighted: ["finishing", "offTheBall", "pace"] },
            {
              id: "defender",
              name: "Centre back",
              highlighted: ["marking", "tackling", "heading", "positioning", "jumpingReach", "strength"],
            },
            { id: "keeper", name: "Goalkeeper", highlighted: ["reflexes", "handling", "oneOnOnes"] },
          ],
        },
      },
    },
  },
};

/** Theme and attribute colours. The App tab only shows in the desktop app. */
export const Look: Story = { args: { tab: "look" } };

export const LookStrictThresholds: Story = {
  args: { tab: "look" },
  parameters: {
    appProviders: {
      storage: {
        attributeColors: {
          activeId: "strict",
          profiles: [{ id: "strict", name: "Strict", thresholds: { excellent: 18, good: 15, average: 10 } }],
        },
      },
    },
  },
};

/** The gear in the site header opens Settings on the tab it was last on. */
export const HeaderButton: Story = {
  render: () => (
    <div className="bg-chrome p-2">
      <SettingsButton />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Settings" }));
    const dialog = within(document.body).getByRole("dialog");
    await expect(within(dialog).getByRole("tab", { name: "Weights" })).toHaveAttribute("aria-selected", "true");
    await expect(within(dialog).queryByRole("tab", { name: "App" })).toBeNull();
  },
};
