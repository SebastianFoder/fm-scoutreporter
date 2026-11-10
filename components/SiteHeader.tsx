"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { AttributeColorConfig } from "./AttributeColorConfig";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { usePlayersData } from "./PlayersDataProvider";

const NAV = [
  { href: "/attribute", label: "Attribute" },
  { href: "/wonderkid", label: "Wonderkid" },
  { href: "/best-xi", label: "Best XI" },
  { href: "/how-to-use", label: "How to use" },
] as const;

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { state } = usePlayersData();
  const count = state.players.length;

  return (
    <header className="bg-chrome text-on-chrome">
      <div className="mx-auto flex h-12 max-w-7xl items-stretch gap-1 px-3 sm:px-5">
        <Link
          href="/"
          aria-label="Scout Reporter home"
          className="mr-3 flex shrink-0 items-center gap-2 font-semibold sm:mr-5"
        >
          <BrandMark className="h-6 w-6" />
          <span className="hidden sm:inline">Scout Reporter</span>
        </Link>

        <nav aria-label="Main" className="flex min-w-0 items-stretch overflow-x-auto">
          {NAV.map((item) => {
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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {count > 0 && (
            <span
              className="hidden whitespace-nowrap text-[13px] text-on-chrome/65 md:inline"
              title="Imported players, shared by both modes"
            >
              {count} players imported
            </span>
          )}
          <AttributeColorConfig />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
