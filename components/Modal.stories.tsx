import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "./Button";
import { Modal, type ModalProps } from "./Modal";

const meta = {
  title: "Components/Modal",
  component: Modal,
  parameters: { layout: "centered" },
  args: {
    open: false,
    onClose: fn(),
    title: "Import players",
    description: "Upload a CSV export from Football Manager.",
    size: "md",
    closeOnOverlayClick: true,
    closeOnEsc: true,
    children: (
      <p className="text-sm">
        Modal body content goes here. Press Escape or click the overlay to close.
      </p>
    ),
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg", "xl", "2xl"] },
    children: { control: false },
    footer: { control: false },
  },
  render: function Render(args: ModalProps) {
    const [open, setOpen] = useState(args.open);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal
          {...args}
          open={open}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OpenByDefault: Story = {
  args: { open: true },
};

export const WithFooter: Story = {
  args: {
    open: true,
    footer: (
      <div className="flex justify-end gap-2">
        <Button color="alt" variant="outline">Cancel</Button>
        <Button>Confirm</Button>
      </div>
    ),
  },
};

export const NoHeader: Story = {
  args: { open: true, title: undefined, description: undefined },
};

export const Large: Story = {
  args: { open: true, size: "xl" },
};
