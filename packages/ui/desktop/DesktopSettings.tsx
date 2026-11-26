"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DesktopSettings, UpdateState } from "@scoutreporter/core/desktop/bridge";
import { Button } from "@scoutreporter/ui/components/Button";
import { useDesktop } from "./DesktopProvider";

/** Under "Check for updates": what the last check found. */
function UpdateStatusLine({ update }: { update: UpdateState }) {
  const t = useTranslations("desktop.settings");
  let text: string;
  if (update.checking) text = t("checking");
  else if (update.error) text = update.error;
  else if (update.available && update.latest) text = t("updateAvailable", { latest: update.latest.version, current: update.current });
  else if (update.checkedAt) text = t("upToDate", { current: update.current });
  else text = t("version", { current: update.current });
  return <span className={`mt-1 block text-[13px] ${update.error ? "text-red" : "text-muted"}`}>{text}</span>;
}

/** A number setting that is saved when you leave the field or press Enter (not on every key). */
function NumberSetting({
  label,
  value,
  min,
  max,
  onSave,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onSave: (value: number) => void;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) onSave(Number(draft));
    setDraft(null);
  };
  return (
    <label className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className="field h-8 w-20 px-2 text-right text-sm"
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      {suffix && <span className="text-[13px] text-muted">{suffix}</span>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  title,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-semibold">{title}</span>
        <span className="block text-[13px] text-muted">{children}</span>
      </span>
    </label>
  );
}

/** The App tab in Settings: the desktop app's own settings. Renders nothing on the website. */
export function DesktopSettingsPanel() {
  const desktop = useDesktop();
  const t = useTranslations("desktop.settings");
  if (!desktop) return null;
  const { settings, updateSettings, reloadActive, loading, update, checkForUpdate } = desktop;
  if (!settings) return <p className="text-sm text-muted">{t("loading")}</p>;
  /** A setting that changes what the screens get: save it, then load the scan in use again. */
  const applyAndReload = (patch: Partial<DesktopSettings>) => void updateSettings(patch).then(() => reloadActive());

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="section-title">{t("scanning")}</h3>
        <Toggle
          title={t("hidden.title")}
          checked={!settings.hideHidden}
          disabled={loading}
          onChange={(on) => applyAndReload({ hideHidden: !on })}
        >
          {t("hidden.body")}
        </Toggle>
        <Toggle title={t("hotkey.title")} checked={settings.hotkey} onChange={(hotkey) => void updateSettings({ hotkey })}>
          {t("hotkey.body")}
        </Toggle>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-semibold">{t("database")}</span>
            <select
              className="field h-8 pl-2 text-sm"
              value={settings.database}
              onChange={(e) => void updateSettings({ database: e.target.value as DesktopSettings["database"] })}
            >
              <option value="men">{t("databases.men")}</option>
              <option value="women">{t("databases.women")}</option>
              <option value="both">{t("databases.both")}</option>
            </select>
          </label>
          <NumberSetting
            label={t("keep")}
            value={settings.retention}
            min={1}
            max={500}
            suffix={t("keepSuffix")}
            onSave={(retention) => void updateSettings({ retention })}
          />
        </div>
        <p className="text-[13px] text-muted">
          {t("retentionNote")}
        </p>
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="section-title">{t("updates")}</h3>
        <Toggle title={t("checkUpdates.title")} checked={settings.checkUpdates} onChange={(checkUpdates) => void updateSettings({ checkUpdates })}>
          {t("checkUpdates.body")}
          {update && <UpdateStatusLine update={update} />}
        </Toggle>
        <Button size="sm" color="alt" variant="outline" disabled={!update || update.checking} onClick={() => void checkForUpdate()}>
          {update?.checking ? t("checking") : t("checkNow")}
        </Button>
      </section>

      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="section-title">{t("privacy")}</h3>
        <Toggle title={t("usageStats.title")} checked={settings.usageStats} onChange={(usageStats) => void updateSettings({ usageStats })}>
          {t("usageStats.body")}
        </Toggle>
      </section>
    </div>
  );
}
