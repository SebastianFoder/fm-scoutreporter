"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import {
  FORMATIONS,
  PITCH_ROWS,
  SLOT_LABEL,
  SPOT_SLOT,
  SPOT_XY,
  findFormation,
  type FormationSpot,
} from "@/lib/best-xi/formations";
import { AUTO, resolveRole, settingsFor, shortRole, sortSettings, type SlotSetting } from "@/lib/best-xi/roles";
import type { WeightProfile } from "@/types/weights";
import { Pitch, spotStyle } from "./PitchLineup";
import { useSavedFormations } from "./useSavedFormations";

const ALL_SPOTS = PITCH_ROWS.flat().filter((s): s is FormationSpot => s !== null);
/** Pointer travel (px) before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 5;
/** How close (pitch units, 68 × 100) a drop must be to a spot to land on it. */
const SNAP_DISTANCE = 9;

type Drag = {
  spot: FormationSpot;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** Pointer position on the pitch, in pitch units. */
  x: number;
  y: number;
  target: FormationSpot | null;
};

/**
 * Formation setup like FM's tactics screen: start from a preset or a saved formation, drag positions
 * between the pitch's spots (drop on another position to swap them), choose the role each is scored
 * on, and save the result under a name. Click a position and then a spot does the same without
 * dragging, and works from the keyboard. Used by Best XI and Squad analysis.
 */
export function FormationEditor({
  slots,
  onChange,
  profiles,
}: {
  slots: SlotSetting[];
  onChange: (slots: SlotSetting[]) => void;
  profiles: WeightProfile[];
}) {
  const { saved, save, remove } = useSavedFormations();
  const [picked, setPicked] = useState<FormationSpot | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [name, setName] = useState("");
  const pitchRef = useRef<HTMLDivElement>(null);

  const spots = slots.map((s) => s.spot);
  const used = new Set(spots);
  const selected = picked && used.has(picked) ? picked : null;
  const preset = findFormation(spots);
  const savedMatch = findFormation(spots, saved);
  const current = preset ?? savedMatch;

  const choose = (id: string) => {
    const f = FORMATIONS.find((x) => x.id === id) ?? saved.find((x) => x.id === id);
    if (f) {
      onChange(settingsFor(f.spots));
      setPicked(null);
    }
  };

  /** Move a position to a spot, keeping its role; onto another position, the two swap. */
  const move = (from: FormationSpot, to: FormationSpot) => {
    if (from === to || to === "GK" || from === "GK") return;
    const place = (s: SlotSetting, spot: FormationSpot) => ({ ...s, spot, slot: SPOT_SLOT[spot] });
    onChange(
      sortSettings(slots.map((s) => (s.spot === from ? place(s, to) : s.spot === to ? place(s, from) : s))),
    );
    setPicked(null);
  };

  const clickSpot = (spot: FormationSpot) => {
    if (spot === "GK") return;
    if (selected && selected !== spot) move(selected, spot);
    else if (used.has(spot)) setPicked(selected === spot ? null : spot);
  };

  /** Pointer position in pitch units, and the spot it is over (if close enough). */
  const locate = (clientX: number, clientY: number, from: FormationSpot) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, target: null };
    const x = ((clientX - rect.left) / rect.width) * 68;
    const y = ((clientY - rect.top) / rect.height) * 100;
    let target: FormationSpot | null = null;
    let best = SNAP_DISTANCE;
    for (const spot of ALL_SPOTS) {
      if (spot === "GK" || spot === from) continue;
      const [sx, sy] = SPOT_XY[spot];
      // The pitch is drawn 68 × 100 at that aspect ratio, so one unit is the same size both ways.
      const d = Math.hypot(sx - x, sy - y);
      if (d < best) {
        best = d;
        target = spot;
      }
    }
    return { x, y, target };
  };

  const onPointerDown = (e: React.PointerEvent, spot: FormationSpot) => {
    if (spot === "GK" || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = SPOT_XY[spot];
    setDrag({ spot, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, x, y, target: null });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    if (!moved) return;
    setDrag({ ...drag, moved, ...locate(e.clientX, e.clientY, drag.spot) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) clickSpot(drag.spot);
    else if (drag.target) move(drag.spot, drag.target);
    setDrag(null);
  };

  const canSave = name.trim() !== "";
  const doSave = () => {
    if (!canSave) return;
    save(name, spots);
    setName("");
  };

  const dragging = drag?.moved ? drag : null;
  const chip =
    "absolute flex h-[7%] w-[16%] -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-[3px] border text-[12px] font-semibold";

  return (
    <>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Formation
        <select
          value={current?.id ?? "custom"}
          onChange={(e) => choose(e.target.value)}
          className="field h-9 w-full pl-2.5 text-sm text-ink"
        >
          {!current && <option value="custom">Custom</option>}
          {saved.length > 0 && (
            <optgroup label="Your formations">
              {saved.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="FM presets">
            {FORMATIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div
        className="mt-3"
        onKeyDown={(e) => {
          if (e.key === "Escape" && selected) {
            e.stopPropagation();
            setPicked(null);
          }
        }}
      >
        <Pitch>
          <div ref={pitchRef} className="absolute inset-0">
            {ALL_SPOTS.map((spot) => {
              const filled = used.has(spot);
              const position = SLOT_LABEL[SPOT_SLOT[spot]];
              const isTarget = dragging?.target === spot;
              if (!filled) {
                const armed = Boolean(selected) || Boolean(dragging);
                return (
                  <button
                    key={spot}
                    type="button"
                    onClick={() => clickSpot(spot)}
                    aria-disabled={!selected}
                    aria-label={selected ? `Move ${selected} to ${spot} (${position})` : `Empty spot ${spot} (${position})`}
                    title={selected ? `Move ${selected} here` : spot}
                    className={[
                      chip,
                      "border-dashed text-[10px]",
                      isTarget
                        ? "border-white bg-white/30 text-white"
                        : armed
                          ? "cursor-pointer border-white/80 text-white/90 hover:bg-white/20"
                          : "cursor-default border-white/35 text-white/45",
                    ].join(" ")}
                    style={spotStyle(spot)}
                  >
                    {spot}
                  </button>
                );
              }
              const isGk = spot === "GK";
              const isSelected = spot === selected;
              const isDragged = dragging?.spot === spot;
              return (
                <button
                  key={spot}
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, spot)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => setDrag(null)}
                  // Pointer presses are handled on pointer up; keyboard presses arrive as a click with detail 0.
                  onClick={(e) => {
                    if (e.detail === 0) clickSpot(spot);
                  }}
                  aria-pressed={isGk ? undefined : isSelected}
                  aria-label={
                    isGk
                      ? "Goalkeeper (fixed)"
                      : isSelected
                        ? `${spot} (${position}) selected: choose a spot to move it to, or press again to cancel`
                        : `${spot} (${position}): drag, or select to move`
                  }
                  title={isGk ? "The keeper stays in goal" : `${position}: drag to another spot, or onto a position to swap`}
                  className={[
                    chip,
                    "touch-none",
                    isDragged
                      ? "z-10 border-accent bg-accent text-on-accent shadow-md"
                      : isSelected
                        ? "border-accent bg-accent text-on-accent outline-2 outline-offset-1 outline-white"
                        : isTarget
                          ? "border-white bg-surface text-ink outline-2 outline-offset-1 outline-white"
                          : "border-line bg-surface text-ink",
                    isGk ? "cursor-default" : isDragged ? "cursor-grabbing" : "cursor-grab hover:border-accent",
                    isDragged ? "" : "transition-[left,top] duration-150",
                  ].join(" ")}
                  style={
                    isDragged ? { left: `${(drag!.x / 68) * 100}%`, top: `${drag!.y}%` } : spotStyle(spot)
                  }
                >
                  {spot}
                </button>
              );
            })}
          </div>
        </Pitch>
      </div>
      <p className="mt-2 text-[12px] text-muted" aria-live="polite">
        {dragging
          ? dragging.target
            ? used.has(dragging.target)
              ? `Drop to swap ${dragging.spot} and ${dragging.target}.`
              : `Drop to move ${dragging.spot} to ${dragging.target}.`
            : "Drop on a spot, or anywhere else to cancel."
          : selected
            ? `Moving ${selected}: click a spot (or another position to swap), or ${selected} again to cancel.`
            : "Drag a position to another spot, or onto a position to swap them."}
      </p>

      <div className="mt-3">
        {savedMatch ? (
          <Button
            color="red"
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
            onClick={() => remove(savedMatch.id)}
          >
            Delete “{savedMatch.name}”
          </Button>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              doSave();
            }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={preset ? `My ${preset.name.split(" ")[0]}` : "Name this formation"}
              aria-label="Name for this formation"
              maxLength={40}
              className="field h-8 min-w-0 flex-1 px-2 text-[13px] text-ink"
            />
            <Button
              type="submit"
              color="alt"
              variant="outline"
              size="sm"
              disabled={!canSave}
              icon={<Save className="h-3.5 w-3.5" aria-hidden />}
            >
              Save
            </Button>
          </form>
        )}
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th className="pb-1 pr-2 font-normal">Position</th>
            <th className="pb-1 font-normal">Scored as</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const auto = resolveRole({ slot: s.slot, role: AUTO }, profiles);
            const missing = s.role !== AUTO && !profiles.some((p) => p.id === s.role);
            return (
              <tr key={s.spot}>
                <td className="whitespace-nowrap py-0.5 pr-2">
                  <span className="font-semibold">{s.spot}</span>{" "}
                  <span className="text-[12px] text-muted">{SLOT_LABEL[s.slot]}</span>
                </td>
                <td className="py-0.5">
                  <select
                    aria-label={`Role for ${s.spot}, ${SLOT_LABEL[s.slot]}`}
                    value={missing ? AUTO : s.role}
                    onChange={(e) => onChange(slots.map((x) => (x.spot === s.spot ? { ...x, role: e.target.value } : x)))}
                    className="field h-8 w-full pl-2 text-[13px] text-ink"
                  >
                    <option value={AUTO}>Auto: {shortRole(auto.name)}</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted">
        Roles are your weight profiles from{" "}
        <Link href="/attribute" className="link">
          Attribute mode
        </Link>
        .
      </p>
    </>
  );
}
