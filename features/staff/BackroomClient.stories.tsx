import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import BackroomClient from "./BackroomClient";

const meta = {
  title: "Pages/Best backroom",
  component: BackroomClient,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/staff/backroom" } },
  },
} satisfies Meta<typeof BackroomClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

export const FullBackroom: Story = {
  parameters: { appProviders: { staff: true } },
};

export const MedicalTeam: Story = {
  parameters: { appProviders: { staff: true, storage: { bestBackroom: { counts: { physio: 1, "sports-scientist": 1 } } } } },
};

/** Asking for more physios than the import has explains which role can't be filled. */
export const NotEnoughStaff: Story = {
  parameters: {
    appProviders: { staff: true, storage: { bestBackroom: { counts: { physio: 3 }, preferredJobOnly: true } } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText(/Not enough staff for every role/)).toBeInTheDocument());
  },
};

export const ExcludeAndRepick: Story = {
  parameters: { appProviders: { staff: true, storage: { bestBackroom: { counts: { scout: 1 } } } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const exclude = await canvas.findByRole("button", { name: /^Exclude .* and pick again$/ });
    const name = exclude.getAttribute("aria-label")!.replace(/^Exclude (.*) and pick again$/, "$1");
    await userEvent.click(exclude);
    await waitFor(() => expect(canvas.getByTitle("Allow this person again")).toHaveTextContent(name));
  },
};
