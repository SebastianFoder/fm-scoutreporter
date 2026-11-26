"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Settings as SettingsIcon } from "lucide-react";
import { Modal } from "./Modal";
import { WeightSettings } from "./WeightConfig";
import { HighlightSettings } from "./HighlightedAttributesConfig";
import { AttributeColourSettings } from "./AttributeColorConfig";
import { ThemeSetting } from "./ThemeSwitcher";
import { useDesktopBridge } from "../desktop/DesktopProvider";
import { DesktopSettingsPanel } from "../desktop/DesktopSettings";

/**
 * Settings: one side panel for everything that applies across the screens. It docks to the right
 * so the page stays visible: change a weight and watch the list re-rank. What belongs to a single
 * screen (filters, formations, Best XI or Squad setup) stays on that screen.
 */
export type SettingsTab = "weights" | "columns" | "look" | "app";

/** Labels are settings.tabs.<id>. */
const TABS: { id: SettingsTab; desktopOnly?: boolean }[] = [
  { id: "weights" },
  { id: "columns" },
  { id: "look" },
  { id: "app", desktopOnly: true },
];

type SettingsContextValue = {
  /** Open Settings, at `tab` (default: the tab it was last on). */
  openSettings: (tab?: SettingsTab) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Opens Settings from anywhere: the header button, or a screen's own Weights or Columns button. */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("weights");
  const openSettings = useCallback((next?: SettingsTab) => {
    if (next) setTab(next);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openSettings }), [openSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
      <SettingsDialog open={open} tab={tab} onTab={setTab} onClose={() => setOpen(false)} />
    </SettingsContext.Provider>
  );
}

function SettingsDialog({
  open,
  tab,
  onTab,
  onClose,
}: {
  open: boolean;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
}) {
  const t = useTranslations("settings");
  const desktop = useDesktopBridge() !== null;
  const tabs = TABS.filter((item) => desktop || !item.desktopOnly);
  const current = tabs.some((item) => item.id === tab) ? tab : "weights";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      placement="side"
      toolbar={
        <div role="tablist" aria-label={t("title")} className="flex overflow-x-auto overflow-y-hidden px-3">
          {tabs.map((item) => {
            const active = item.id === current;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`settings-tab-${item.id}`}
                aria-selected={active}
                aria-controls="settings-panel"
                onClick={() => onTab(item.id)}
                className={[
                  "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
                  active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
                ].join(" ")}
              >
                {t(`tabs.${item.id}`)}
              </button>
            );
          })}
        </div>
      }
    >
      <div role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${current}`}>
        {current === "weights" && <WeightSettings />}
        {current === "columns" && <HighlightSettings />}
        {current === "look" && (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="section-title">{t("look.theme")}</h3>
              <ThemeSetting />
            </section>
            <section className="space-y-2 border-t border-line pt-4">
              <h3 className="section-title">{t("look.attributeColours")}</h3>
              <AttributeColourSettings />
            </section>
          </div>
        )}
        {current === "app" && <DesktopSettingsPanel />}
      </div>
    </Modal>
  );
}

/** The gear in the site header. */
export function SettingsButton() {
  const { openSettings } = useSettings();
  const t = useTranslations("settings");
  return (
    <button
      type="button"
      onClick={() => openSettings()}
      title={t("title")}
      className="btn h-8 gap-1.5 px-2 text-[13px] font-medium text-on-chrome/80 hover:bg-on-chrome/10 hover:text-on-chrome"
    >
      <SettingsIcon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{t("title")}</span>
    </button>
  );
}
