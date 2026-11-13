"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
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

  const percent = install ? Math.round(install.progress * 100) : 0;
  return (
    <div role="status" className="border-b border-line bg-accent/8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-sm sm:px-5">
        <p className="min-w-0 flex-1">
          {install ? (
            install.phase === "starting" ? (
              <>Installing Scout Reporter {latest.version}. The app closes and opens again in a moment.</>
            ) : (
              <>
                Downloading Scout Reporter {latest.version}… {percent}%
              </>
            )
          ) : (
            <>
              <span className="font-semibold">Scout Reporter {latest.version} is out</span>{" "}
              <span className="text-muted">
                (you have {update.current}). Updating keeps your settings, scans, weights and formations.
              </span>
              {error && <span className="block text-red">{error}</span>}
            </>
          )}
        </p>
        {!install && (
          <div className="flex items-center gap-2">
            <Button size="sm" icon={<Download className="h-4 w-4" aria-hidden />} onClick={() => void desktop.installUpdate()}>
              Update now
            </Button>
            <a href={latest.pageUrl} target="_blank" rel="noreferrer" className="link text-[13px]">
              What&apos;s new
            </a>
            {error && (
              <a href={latest.downloadUrl} target="_blank" rel="noreferrer" className="link text-[13px]">
                Download it yourself
              </a>
            )}
            <Button
              size="sm"
              color="alt"
              variant="ghost"
              aria-label={`Hide until a version newer than ${latest.version}`}
              icon={<X className="h-4 w-4" aria-hidden />}
              onClick={dismiss}
            />
          </div>
        )}
      </div>
    </div>
  );
}
