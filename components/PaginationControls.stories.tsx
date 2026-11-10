import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { PaginationControls, type PageSizeChoice } from "./PaginationControls";

const meta = {
  title: "Components/PaginationControls",
  component: PaginationControls,
  args: {
    page: 1,
    pageCount: 25,
    pageSize: 10,
    totalItems: 248,
    showingFrom: 1,
    showingTo: 10,
    onPageChange: fn(),
    onPageSizeChange: fn(),
  },
} satisfies Meta<typeof PaginationControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Static: Story = {};

export const Interactive: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(args.page);
    const [pageSize, setPageSize] = useState<PageSizeChoice>(args.pageSize);
    const size = pageSize === "all" ? args.totalItems : pageSize;
    const pageCount = Math.max(1, Math.ceil(args.totalItems / size));
    const current = Math.min(page, pageCount);
    const showingFrom = (current - 1) * size + 1;
    const showingTo = Math.min(args.totalItems, current * size);

    return (
      <PaginationControls
        {...args}
        page={current}
        pageCount={pageCount}
        pageSize={pageSize}
        showingFrom={showingFrom}
        showingTo={showingTo}
        onPageChange={(p) => {
          setPage(p);
          args.onPageChange(p);
        }}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
          args.onPageSizeChange(s);
        }}
      />
    );
  },
};

export const LastPage: Story = {
  args: { page: 25, showingFrom: 241, showingTo: 248 },
};

/** Renders nothing: the controls hide themselves when there are no items. */
export const Empty: Story = {
  args: { totalItems: 0, pageCount: 1, showingFrom: 0, showingTo: 0 },
};
