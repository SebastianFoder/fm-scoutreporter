import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GRADE_SCALE } from "@scoutreporter/core/grades";
import { GradeStamp } from "./GradeStamp";

const meta = {
  title: "Components/GradeStamp",
  component: GradeStamp,
  parameters: { appProviders: { disable: true } },
  args: { score: 13.8 },
} satisfies Meta<typeof GradeStamp>;

export default meta;
type Story = StoryObj<typeof meta>;

const bottomOf = (min: number) => (Number.isFinite(min) ? min : 8);

/** The prime benchmark (13.8). */
export const Default: Story = {};

export const Large: Story = { args: { size: "lg", score: 16.7, label: "Potential" } };

/** Every grade, best first, at the bottom of its band. */
export const Scale: Story = {
  render: () => (
    <div className="space-y-4">
      {(["sm", "lg"] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          {GRADE_SCALE.map((g) => (
            <GradeStamp key={g.grade} size={size} score={bottomOf(g.min)} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** The top grades: S shines on a loop, S+ breathes, S++ adds a holographic border. */
export const Elite: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6 p-4">
      {[16, 16.5, 17, 17.5].map((score) => (
        <div key={score} className="flex items-center gap-3">
          <GradeStamp score={score} size="lg" />
          <GradeStamp score={score} />
        </div>
      ))}
    </div>
  ),
};

/** In a table: every fill drifts slowly, and only the top grades shine and glow. */
export const InTable: Story = {
  render: () => (
    <table className="data-table max-w-sm">
      <tbody>
        {[17.8, 17.1, 16.6, 15.6, 14.2, 13.1, 12.4, 11.2, 9.8].map((s) => (
          <tr key={s}>
            <td className="px-3 py-2">Player {s.toFixed(1)}</td>
            <td className="px-3 py-2 text-right font-bold">
              <span className="inline-flex items-center justify-end gap-2">
                {((s / 13) * 100).toFixed(2)}
                <GradeStamp score={s} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
