import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import WonderkidClient from "./WonderkidClient";

const meta = {
  title: "Pages/Wonderkid",
  component: WonderkidClient,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/wonderkid" } },
  },
} satisfies Meta<typeof WonderkidClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

/** v1 export has no CA/PA, so potential projections are unavailable. */
export const V1Import: Story = {
  parameters: { appProviders: { players: "fm26" } },
};

export const V2Import: Story = {
  parameters: { appProviders: { players: "fm27v2" } },
};
