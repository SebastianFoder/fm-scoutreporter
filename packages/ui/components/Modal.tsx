"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Below the title, outside the scrolling body: tabs, for example. */
  toolbar?: React.ReactNode;
  size?: ModalSize;
  /**
   * "center" is a classic dialog. "side" docks a panel to the right and keeps the
   * page visible, so edits (weights, columns) can be watched re-ranking the table.
   */
  placement?: "center" | "side";
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
}

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  toolbar,
  size = "md",
  placement = "center",
  closeOnOverlayClick = true,
  closeOnEsc = true,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement as HTMLElement | null;

    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      lastActiveRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!closeOnEsc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const side = placement === "side";

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 ${side ? "bg-[oklch(0.15_0.01_255/0.18)]" : "bg-[oklch(0.15_0.01_255/0.5)]"}`}
      />

      <div
        className={`absolute inset-0 flex ${side ? "justify-end" : "items-center justify-center p-4"}`}
        onMouseDown={(e) => {
          if (!closeOnOverlayClick) return;
          const target = e.target as Node | null;
          if (!target) return;
          if (panelRef.current && !panelRef.current.contains(target)) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          ref={panelRef}
          className={
            side
              ? "flex h-full w-full max-w-md flex-col border-l border-line bg-surface text-ink shadow-[-8px_0_24px_oklch(0.15_0.01_255/0.12)] outline-none"
              : `flex max-h-[calc(100vh-2rem)] w-full ${sizeClass[size]} flex-col rounded-md border border-line bg-surface text-ink outline-none`
          }
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                {title && (
                  <h2 id={titleId} className="text-lg font-semibold leading-tight">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="btn h-8 w-8 shrink-0 text-muted hover:bg-ink/6 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {toolbar && <div className="shrink-0 border-b border-line">{toolbar}</div>}

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="shrink-0 border-t border-line bg-paper px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
