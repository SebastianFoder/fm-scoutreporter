"use client";

import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** Tooltip, e.g. why an option is disabled. */
  title?: string;
};

/** A row of two to four mutually exclusive buttons: the app's toggle for small either/or choices. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  labelledBy,
  size = "md",
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name when there is no visible label to point at. */
  label?: string;
  labelledBy?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`inline-flex overflow-hidden rounded-md ring-1 ring-line ${size === "md" ? "h-9" : "h-8"} ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            disabled={o.disabled}
            title={o.title}
            className={[
              "flex-1 whitespace-nowrap px-3",
              size === "md" ? "text-sm" : "text-[13px]",
              active
                ? "bg-accent font-semibold text-on-accent"
                : "cursor-pointer text-muted hover:bg-paper hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
