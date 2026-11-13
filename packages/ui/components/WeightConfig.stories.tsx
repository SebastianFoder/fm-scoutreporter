import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "./Button";
import { WeightConfigModal } from "./WeightConfig";

const meta = {
  title: "Config/WeightConfigModal",
  component: WeightConfigModal,
  parameters: { layout: "centered" },
  args: { open: true, onClose: fn() },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Weights</Button>
        <WeightConfigModal
          open={open}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof WeightConfigModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First run: FM27 benchmark profiles seeded, "10" role active. */
export const Default: Story = {};

export const CustomProfile: Story = {
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
