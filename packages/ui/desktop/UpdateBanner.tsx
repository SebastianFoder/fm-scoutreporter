"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../components/Button";
import { useDesktop } from "./DesktopProvider";

/** localStorage key: the version whose banner was closed (it shows again for a newer one). */
const DISMISSED_KEY = "desktopUpdateDismissed";

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/**
 * Desktop app only: a bar under the header when a newer version is out, with "Update now" (download,
 * check and install it; the app restarts by itself and keeps all your settings and scans) and a link
 * to what changed. Nothing on the website.
 */
export function UpdateBanner() {
  const desktop = useDesktop();
  const t = useTranslations("desktop.update");
  const [dismissed, setDismissed] = useState<string | null>(() => (typeof window === "undefined" ? null : readDismissed()));
  const update = desktop?.update;
  if (!desktop || !update?.available || !update.latest) return null;
  const { latest, install, error } = update;
  if (dismissed === latest.version && !install) return null;

  const dismiss = () => {
    setDismissed(latest.version);
    try {
      window.localStorage.setItem(DISMISSED_KEY, latest.version);
    } catch {
      // closed for this session only
    }
  };

  const share = install ? Math.round(install.progress * 100) / 100 : 0;
  return (
    <div role="status" className="border-b border-line bg-accent/8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-sm sm:px-5">
        <p className="min-w-0 flex-1">
          {install ? (
            install.phase === "starting" ? (
              t("installing", { version: latest.version })
            ) : (
              t("downloading", { version: latest.version, progress: share })
            )
          ) : (
            <>
              <span className="font-semibold">{t("available", { version: latest.version })}</span>{" "}
              <span className="text-muted">{t("availableDetail", { current: update.current })}</span>
              {error && <span className="block text-red">{error}</span>}
            </>
          )}
        </p>
        {!install && (
          <div className="flex items-center gap-2">
            <Button size="sm" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => void desktop.installUpdate()}>
              {t("updateNow")}
            </Button>
            <a href={latest.pageUrl} target="_blank" rel="noreferrer" className="link text-[13px]">
              {t("whatsNew")}
            </a>
            {error && (
              <a href={latest.downloadUrl} target="_blank" rel="noreferrer" className="link text-[13px]">
                {t("downloadYourself")}
              </a>
            )}
            <Button
              size="sm"
              color="alt"
              variant="ghost"
              aria-label={t("hide", { version: latest.version })}
              icon={<X className="h-4 w-4" aria-hidden />}
              onClick={dismiss}
            />
          </div>
        )}
      </div>
    </div>
  );
}
