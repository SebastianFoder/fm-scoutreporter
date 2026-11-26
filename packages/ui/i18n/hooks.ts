
import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { attributeLabel } from "@scoutreporter/core/attribute-labels";
import { FM27_ROLES } from "@scoutreporter/core/fm27/benchmarks";
import { intlTag } from "./locales";

/**
 * BCP 47 tag for the current language, for toLocaleString / Intl: "en" → "en-GB", "fr" → "fr-FR".
 * Use instead of a hard-coded "en-GB".
 */
export function useIntlLocale(): string {
  return intlTag(useLocale());
}

/** Number formatter for the current language: `formatNumber(12500)` → "12,500" / "12 500" / "12.500". */
export function useFormatNumber(): (value: number, options?: Intl.NumberFormatOptions) => string {
  const tag = useIntlLocale();
  return useCallback((value, options) => value.toLocaleString(tag, options), [tag]);
}

/**
 * FM's label for a player attribute key in the current language ("offTheBall" → "Appels de balle").
 * Replaces core's attributeLabel() in components. Unknown keys fall back to attributeLabel's English.
 */
export function useAttributeLabel(): (key: string) => string {
  const t = useTranslations("fm.attributes");
  return useCallback((key: string) => (t.has(key) ? t(key) : attributeLabel(key)), [t]);
}


/** The built-in FM27 profiles' English names, by profile ID. */
const FM27_DEFAULT_NAMES = new Map(FM27_ROLES.map((r) => [r.profileId, r.name]));

/**
 * A weight profile's name for display. The built-in FM27 role profiles show FM's role names in the
 * current language ("FM27 · Défenseur central"); a name the user typed is shown as they typed it.
 */
export function useProfileName(): (profile: { id: string; name: string; builtIn?: string }) => string {
  const t = useTranslations("fm.fm27Roles");
  return useCallback(
    (profile) =>
      profile.builtIn === "fm27" && FM27_DEFAULT_NAMES.get(profile.id) === profile.name && t.has(profile.id)
        ? `FM27 · ${t(profile.id)}`
        : profile.name,
    [t],
  );
}
