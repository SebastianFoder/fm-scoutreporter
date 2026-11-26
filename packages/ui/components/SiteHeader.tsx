"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandMark } from "./BrandMark";
import { ThemeSync } from "./ThemeSwitcher";
import { SettingsButton } from "./Settings";
import { usePlayersData } from "./PlayersDataProvider";
import { ScanButton } from "../desktop/ScanButton";
import { useDesktopBridge } from "../desktop/DesktopProvider";
import { UpdateBanner } from "../desktop/UpdateBanner";
import { LanguagePicker } from "./LanguagePicker";
import { useFormatNumber } from "../i18n/hooks";

/** Labels are keys in chrome.nav. */
const NAV = [
  { href: "/players", label: "players" },
  { href: "/squad", label: "squad" },
  { href: "/staff", label: "staff" },
  { href: "/how-to-use", label: "howToUse" },
  { href: "/download", label: "desktopApp" },
] as const;

/** The desktop app adds its scan screens and drops the CSV setup guide. */
const DESKTOP_NAV = [
  { href: "/desktop", label: "scans" },
  ...NAV.filter((item) => item.href !== "/how-to-use" && item.href !== "/download"),
  { href: "/growth", label: "growth" },
] as const;

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { state } = usePlayersData();
  const count = state.players.length;
  const nav = useDesktopBridge() ? DESKTOP_NAV : NAV;
  const t = useTranslations("chrome");
  const formatNumber = useFormatNumber();
  const total = state.source?.total && state.source.total > count ? state.source.total : null;

  return (
    <>
    <header className="bg-chrome text-on-chrome">
      <div className="mx-auto flex h-12 max-w-7xl items-stretch gap-1 px-3 sm:px-5">
        <Link
          href="/"
          aria-label={t("homeLabel")}
          className="mr-3 flex shrink-0 items-center gap-2 font-semibold sm:mr-5"
        >
          <BrandMark className="h-6 w-6" />
          <span className="hidden sm:inline">Scout Reporter</span>
        </Link>

        <nav aria-label={t("mainNav")} className="flex min-w-0 items-stretch overflow-x-auto">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex shrink-0 items-center border-b-2 px-2.5 text-sm sm:px-3",
                  active
                    ? "border-on-chrome font-semibold text-on-chrome"
                    : "border-transparent text-on-chrome/70 hover:text-on-chrome",
                ].join(" ")}
              >
                {t(`nav.${item.label}`)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ScanButton />
          {count > 0 && (
            <span
              className="hidden whitespace-nowrap text-[13px] text-on-chrome/65 md:inline"
              title={t("playerCount.title")}
            >
              {t(state.source ? "playerCount.scanned" : "playerCount.imported", {
                count,
                shown: formatNumber(count),
                total: total === null ? "" : formatNumber(total),
                hasTotal: total === null ? "no" : "yes",
              })}
            </span>
          )}
          <LanguagePicker />
          <SettingsButton />
          <ThemeSync />
        </div>
      </div>
    </header>
    {/* Desktop app only: a newer version is out. */}
    <UpdateBanner />
    </>
  );
}
