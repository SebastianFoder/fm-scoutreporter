"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionTab = { href: string; label: string };

/** The screens in the Players section of the main menu. */
export const PLAYERS_TABS: SectionTab[] = [
  { href: "/players", label: "Players" },
  { href: "/players/best-xi", label: "Best XI" },
];

/** The screens in the Staff section of the main menu. */
export const STAFF_TABS: SectionTab[] = [
  { href: "/staff", label: "Staff" },
  { href: "/staff/backroom", label: "Best backroom" },
];

/**
 * Tabs for the screens inside one section of the main menu (Players, Staff, How to use). They are
 * real links, so every screen keeps its own URL.
 */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname() ?? tabs[0].href;
  return (
    <nav className="flex overflow-x-auto border-b border-line" aria-label={label}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm",
              active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
