import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AttributeModeHome from "./AttributeModeHome";

const meta = {
  title: "Pages/AttributeHome",
  component: AttributeModeHome,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/attribute" } },
  },
} satisfies Meta<typeof AttributeModeHome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

export const FM26Import: Story = {
  parameters: { appProviders: { players: "fm26" } },
};

export const FM27V2Import: Story = {
  parameters: { appProviders: { players: "fm27hidden" } },
};
