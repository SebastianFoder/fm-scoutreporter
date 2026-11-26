"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatNumber } from "../i18n/hooks";
import { Button } from "./Button";

export type PageSizeChoice = 10 | 25 | 50 | 100 | "all";

export type PaginationControlsProps = {
  page: number;
  pageCount: number;
  pageSize: PageSizeChoice;
  totalItems: number;
  /** Inclusive range of visible row indices (1-based for display). */
  showingFrom: number;
  showingTo: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeChoice) => void;
};

const SIZE_OPTIONS: PageSizeChoice[] = [10, 25, 50, 100, "all"];

export function PaginationControls({
  page,
  pageCount,
  pageSize,
  totalItems,
  showingFrom,
  showingTo,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const t = useTranslations("common.pagination");
  const formatNumber = useFormatNumber();
  /* The typed value belongs to the page it was typed on; when the page changes
     from outside, the field falls back to showing that page. */
  const [draft, setDraft] = useState<{ page: number; value: string } | null>(null);
  const jumpValue = draft && draft.page === page ? draft.value : String(page);

  if (totalItems === 0) {
    return null;
  }

  const applyJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isFinite(n)) return;
    const next = Math.min(pageCount, Math.max(1, n));
    onPageChange(next);
    setDraft({ page: next, value: String(next) });
  };

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted">
        <span>
          {t.rich("range", {
            from: showingFrom,
            to: showingTo,
            total: totalItems,
            b: (chunks) => <span className="font-semibold text-ink">{chunks}</span>,
          })}
        </span>
        <label className="inline-flex items-center gap-1.5">
          {t("rows")}
          <select
            value={pageSize === "all" ? "all" : String(pageSize)}
            onChange={(e) => {
              const v = e.target.value;
              onPageSizeChange(v === "all" ? "all" : (Number(v) as PageSizeChoice));
            }}
            className="field h-8 pl-2 text-[13px] text-ink"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={String(s)} value={s === "all" ? "all" : String(s)}>
                {s === "all" ? t("all") : formatNumber(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          {t("goTo")}
          <input
            type="number"
            min={1}
            max={pageCount}
            value={jumpValue}
            onChange={(e) => setDraft({ page, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && applyJump()}
            className="field h-8 w-14 px-2 text-right text-[13px] text-ink"
          />
          <Button color="alt" variant="outline" size="sm" type="button" onClick={applyJump}>
            {t("go")}
          </Button>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          color="alt"
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          {t("first")}
        </Button>
        <Button
          color="alt"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
        >
          {t("prev")}
        </Button>
        <span className="min-w-[4rem] px-1 text-center text-[13px] font-semibold">
          {formatNumber(page)} <span className="font-normal text-muted">/ {formatNumber(pageCount)}</span>
        </span>
        <Button
          color="alt"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          icon={<ChevronRight className="h-4 w-4" aria-hidden />}
          iconPosition="right"
        >
          {t("next")}
        </Button>
        <Button
          color="alt"
          variant="ghost"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(pageCount)}
        >
          {t("last")}
        </Button>
      </div>
    </div>
  );
}

export function parsePageSizeParam(raw: string | null): PageSizeChoice {
  if (raw === "all") return "all";
  const n = parseInt(raw ?? "", 10);
  if (n === 10 || n === 25 || n === 50 || n === 100) return n;
  return 10;
}

export function parsePageParam(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
