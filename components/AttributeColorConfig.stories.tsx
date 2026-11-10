import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AttributeColorConfig } from "./AttributeColorConfig";

const meta = {
  title: "Config/AttributeColorConfig",
  component: AttributeColorConfig,
} satisfies Meta<typeof AttributeColorConfig>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The header trigger button, as it appears in the app's top bar. */
export const Trigger: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await userEvent.click(button);
    await expect(within(document.body).getByRole("dialog")).toBeInTheDocument();
  },
};

export const StrictThresholds: Story = {
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
  play: Open.play,
};
