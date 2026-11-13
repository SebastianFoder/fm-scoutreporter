import type { WeightProfile } from "@scoutreporter/core/types/weights";

export function exportProfile(profile: WeightProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function importProfile(json: string): WeightProfile {
  const parsed = JSON.parse(json);
  // optional: add validation here
  return parsed as WeightProfile;
}
