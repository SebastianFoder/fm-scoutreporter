import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download, Trash2 } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "./Button";

const COLORS = ["primary", "alt", "red", "gold", "silver", "bronze"] as const;
const VARIANTS = ["solid", "outline", "ghost"] as const;

const meta = {
  title: "Components/Button",
  component: Button,
  args: {
    children: "Button",
    onClick: fn(),
  },
  argTypes: {
    color: { control: "select", options: COLORS },
    variant: { control: "inline-radio", options: VARIANTS },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    iconPosition: { control: "inline-radio", options: ["left", "right"] },
    icon: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const WithIcon: Story = {
  args: { icon: <Download size={16} />, children: "Export CSV" },
};

export const IconRight: Story = {
  args: { icon: <Trash2 size={16} />, iconPosition: "right", color: "red", children: "Delete" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">Small</Button>
      <Button {...args} size="md">Medium</Button>
      <Button {...args} size="lg">Large</Button>
    </div>
  ),
};

export const Matrix: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="grid grid-cols-[auto_repeat(3,max-content)] items-center gap-3">
      <span />
      {VARIANTS.map((v) => (
        <span key={v} className="text-xs font-bold uppercase tracking-wide">
          {v}
        </span>
      ))}
      {COLORS.map((c) => (
        <div key={c} className="contents">
          <span className="font-mono text-xs">{c}</span>
          {VARIANTS.map((v) => (
            <Button key={v} {...args} color={c} variant={v}>
              {c}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};
