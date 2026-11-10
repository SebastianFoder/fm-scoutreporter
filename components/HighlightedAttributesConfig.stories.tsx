import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "./Button";
import { HighlightConfigModal } from "./HighlightedAttributesConfig";

const meta = {
  title: "Config/HighlightConfigModal",
  component: HighlightConfigModal,
  parameters: { layout: "centered" },
  args: { open: true, onClose: fn() },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    return (
      <>
        <Button color="alt" variant="outline" onClick={() => setOpen(true)}>
          Columns
        </Button>
        <HighlightConfigModal
          open={open}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof HighlightConfigModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ManyProfiles: Story = {
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
