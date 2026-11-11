import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GRADE_SCALE } from "@/lib/grades";
import { GradeStamp } from "./GradeStamp";

const meta = {
  title: "Components/GradeStamp",
  component: GradeStamp,
  parameters: { appProviders: { disable: true } },
  args: { score: 13.8 },
} satisfies Meta<typeof GradeStamp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The prime benchmark (13.8). */
export const Default: Story = {};

export const Large: Story = { args: { size: "lg", score: 16.7, label: "Potential" } };

/** Every grade, best first, at the bottom of its band. */
export const Scale: Story = {
  render: () => (
    <div className="space-y-3">
      {(["sm", "lg"] as const).map((size) => (
        <div key={size} className="flex flex-wrap gap-2">
          {GRADE_SCALE.map((g) => (
            <GradeStamp key={g.grade} size={size} score={Number.isFinite(g.min) ? g.min : 8} />
          ))}
        </div>
      ))}
    </div>
  ),
};
