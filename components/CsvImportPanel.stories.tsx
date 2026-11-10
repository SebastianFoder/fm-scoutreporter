import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CsvImportPanel } from "./CsvImportPanel";
import { usePlayersData } from "./PlayersDataProvider";

/** Shows what the panel wrote into PlayersDataProvider, so imports are visible in the story. */
function ImportStatus() {
  const { state } = usePlayersData();
  return (
    <p data-testid="import-status" className="font-mono text-sm font-bold">
      {state.players.length > 0
        ? `${state.players.length} players loaded${state.caModels ? " (v2: CA/PA)" : ""}`
        : "No import"}
    </p>
  );
}

const meta = {
  title: "Components/CsvImportPanel",
  component: CsvImportPanel,
  args: { onImported: fn() },
  argTypes: {
    testFixture: { control: "inline-radio", options: ["attribute", "attribute-fm27-v2"] },
  },
  decorators: [
    (Story) => (
      <div className="flex max-w-4xl flex-col gap-4">
        <Story />
        <ImportStatus />
      </div>
    ),
  ],
} satisfies Meta<typeof CsvImportPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithExistingImport: Story = {
  parameters: { appProviders: { players: "fm26" } },
};

export const LoadTestData: Story = {
  args: { testFixture: "attribute-fm27-v2" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /load test data/i }));
    await waitFor(() =>
      expect(canvas.getByTestId("import-status")).toHaveTextContent(/players loaded \(v2/),
    );
    await expect(args.onImported).toHaveBeenCalled();
  },
};

export const ClearImport: Story = {
  parameters: { appProviders: { players: "fm26" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /clear import/i }));
    await expect(canvas.getByTestId("import-status")).toHaveTextContent("No import");
  },
};
