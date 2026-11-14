"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import { SNAPSHOT_NAME_MAX, type SnapshotInfo, type SnapshotPatch } from "@scoutreporter/core/desktop/bridge";
import { Button } from "@scoutreporter/ui/components/Button";
import { scanLabel } from "./DesktopProvider";

/**
 * One stored scan on the Scans page: a star (starred scans are never deleted to make room for new
 * ones), its name (click the pencil to rename; an empty name brings back the date), the details,
 * and Use / Delete.
 */
export function StoredScanRow({
  scan,
  inUse,
  loading,
  details,
  onUse,
  onDelete,
  onUpdate,
}: {
  scan: SnapshotInfo;
  inUse: boolean;
  loading: boolean;
  /** The line under the name: counts, club, version, size, search. */
  details: ReactNode;
  onUse: () => void;
  onDelete: () => void;
  onUpdate: (patch: SnapshotPatch) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const label = scanLabel(scan);
  const dateLabel = scanLabel({ ...scan, name: undefined });

  const save = () => {
    if (draft === null) return;
    const name = draft.trim();
    setDraft(null);
    if (name !== (scan.name ?? "")) void onUpdate({ name: name || null });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <button
        type="button"
        aria-pressed={!!scan.favorite}
        aria-label={scan.favorite ? `Unstar ${label}` : `Star ${label}`}
        title={scan.favorite ? "Starred: never deleted to make room for new scans" : "Star: never delete this scan to make room for new ones"}
        onClick={() => void onUpdate({ favorite: !scan.favorite })}
        className={`btn h-8 w-8 shrink-0 hover:bg-ink/6 ${scan.favorite ? "text-gold" : "text-muted/60 hover:text-ink"}`}
      >
        <Star className={`h-4 w-4 ${scan.favorite ? "fill-current" : ""}`} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        {draft === null ? (
          <p className="flex flex-wrap items-center gap-x-2 font-semibold">
            <span className="min-w-0 break-words">{label}</span>
            <button
              type="button"
              aria-label={`Rename ${label}`}
              title="Rename"
              onClick={() => setDraft(scan.name ?? "")}
              className="btn h-6 w-6 text-muted hover:bg-ink/6 hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            {inUse && <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[12px] font-semibold text-accent">In use</span>}
            {!scan.versionOk && <span className="text-[12px] font-normal text-red">version differs</span>}
          </p>
        ) : (
          <input
            autoFocus
            aria-label={`Name for ${dateLabel}`}
            className="field h-8 w-full max-w-sm px-2 text-sm font-semibold"
            maxLength={SNAPSHOT_NAME_MAX}
            placeholder={dateLabel}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setDraft(null);
            }}
          />
        )}
        <p className="text-[13px] text-muted">
          {scan.name && `${dateLabel} · `}
          {details}
        </p>
      </div>
      <Button color="alt" variant="outline" size="sm" disabled={inUse || loading} onClick={onUse}>
        Use
      </Button>
      <Button
        color="red"
        variant="ghost"
        size="sm"
        aria-label={`Delete ${label}`}
        icon={<Trash2 className="h-4 w-4" aria-hidden />}
        onClick={onDelete}
      />
    </li>
  );
}
