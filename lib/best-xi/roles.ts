import type { PositionSlot } from "@/lib/position-slots";
import { FM27_ROLES } from "@/lib/fm27/benchmarks";
import { LEGACY_EMPHASIS } from "@/lib/scoring";
import type { AttributeWeights, WeightProfile } from "@/types/weights";
import {
  DEFAULT_SLOT_ROLE,
  SPOT_SLOT,
  isFormationSpot,
  isPositionSlot,
  isValidFormation,
  sortSpots,
  spotsForSlots,
  type FormationSpot,
} from "./formations";

/** Role value meaning "the FM27 benchmark role for this position". */
export const AUTO = "auto";

/**
 * One position of a line-up: its spot on the tactics pitch, the export position that spot needs
 * (kept in step with the spot), and the weight profile it is scored on (a profile id, or AUTO).
 */
export type SlotSetting = { spot: FormationSpot; slot: PositionSlot; role: string };

export function slotSetting(spot: FormationSpot, role: string = AUTO): SlotSetting {
  return { spot, slot: SPOT_SLOT[spot], role };
}

/** Settings for a formation's spots, every role on Auto. */
export function settingsFor(spots: FormationSpot[]): SlotSetting[] {
  return sortSpots(spots).map((spot) => slotSetting(spot));
}

/** Settings sorted into team sheet order. */
export function sortSettings(slots: SlotSetting[]): SlotSetting[] {
  const order = sortSpots(slots.map((s) => s.spot));
  return order.map((spot) => slots.find((s) => s.spot === spot)!);
}

export type Role = { id: string; name: string; weights: AttributeWeights; emphasis: number };

/** The profile a slot is scored on: the chosen one, else the FM27 benchmark role for that position. */
export function resolveRole(setting: Pick<SlotSetting, "slot" | "role">, profiles: WeightProfile[]): Role {
  const chosen = setting.role === AUTO ? undefined : profiles.find((p) => p.id === setting.role);
  if (chosen) {
    return { id: chosen.id, name: chosen.name, weights: chosen.weights, emphasis: chosen.emphasis ?? LEGACY_EMPHASIS };
  }
  const def = FM27_ROLES.find((r) => r.role === DEFAULT_SLOT_ROLE[setting.slot])!;
  const saved = profiles.find((p) => p.id === def.profileId);
  return saved
    ? { id: saved.id, name: saved.name, weights: saved.weights, emphasis: saved.emphasis ?? 1 }
    : { id: def.profileId, name: def.name, weights: def.weights, emphasis: 1 };
}

export const shortRole = (name: string) => name.replace(/^FM27 · /, "");

/**
 * Eleven stored slot settings, or null when the value is not a valid formation. Settings saved
 * before the tactics pitch only have export positions; they are laid out on spots when possible.
 */
export function parseSlotSettings(value: unknown): SlotSetting[] | null {
  if (!Array.isArray(value) || value.length !== 11) return null;
  const roleOf = (x: { role?: unknown }) => (typeof x?.role === "string" ? x.role : AUTO);

  if (value.every((x) => isFormationSpot(x?.spot))) {
    const spots = value.map((x) => x.spot as FormationSpot);
    if (!isValidFormation(spots)) return null;
    return sortSettings(value.map((x) => slotSetting(x.spot, roleOf(x))));
  }
  if (value.every((x) => isPositionSlot(x?.slot))) {
    const spots = spotsForSlots(value.map((x) => x.slot));
    if (!spots) return null;
    return sortSettings(value.map((x, i) => slotSetting(spots[i], roleOf(x))));
  }
  return null;
}
