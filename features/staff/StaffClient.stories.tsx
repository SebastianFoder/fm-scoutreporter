import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import StaffClient from "./StaffClient";

const meta = {
  title: "Pages/Staff",
  component: StaffClient,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/staff" } },
  },
} satisfies Meta<typeof StaffClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

export const WithImport: Story = {
  parameters: { appProviders: { staff: true } },
};

/** Rank everyone as a goalkeeping coach: the weighted columns turn bold. */
export const RankByRole: Story = {
  parameters: { appProviders: { staff: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rankBy = await canvas.findByLabelText("Rank by");
    await userEvent.selectOptions(rankBy, "coach-goalkeeping");
    await waitFor(() => expect(canvas.getByText(/Coach: goalkeeping:/)).toBeInTheDocument());
  },
};

/** Filtering by a job scores everyone on it and shows only the attributes fm-scoring weights for it. */
export const FilterByJob: Story = {
  parameters: { appProviders: { staff: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(await canvas.findByLabelText("Preferred job"), "Scout");
    await waitFor(() => expect(canvas.getByText(/attributes fm-scoring weights for this job/)).toBeInTheDocument());
    await expect(canvas.queryByRole("button", { name: "GK" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "JPA" })).toBeInTheDocument();
  },
};

export const StaffDetail: Story = {
  parameters: { appProviders: { staff: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("Search"), "Achterberg");
    await userEvent.click(await canvas.findByRole("button", { name: "John Achterberg" }));
    const dialog = await within(document.body).findByRole("dialog");
    await expect(within(dialog).getByText(/\(preferred\)/)).toBeInTheDocument();
  },
};
