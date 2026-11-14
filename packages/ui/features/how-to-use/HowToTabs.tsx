"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const HOW_TO_PAGES = [
  { href: "/how-to-use", label: "Setup guide" },
  { href: "/how-to-use/players", label: "Players" },
  { href: "/how-to-use/wonderkids", label: "Wonderkids" },
] as const;

/** Section tabs for the how-to pages. Real links, so each guide has its own URL. */
export function HowToTabs() {
  const pathname = usePathname() ?? "/how-to-use";
  return (
    <nav className="flex overflow-x-auto border-b border-line" aria-label="Guides">
      {HOW_TO_PAGES.map((page) => {
        const active = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={active ? "page" : undefined}
            className={[
              "-mb-px shrink-0 border-b-2 px-4 py-2 text-sm",
              active
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-muted hover:text-ink",
            ].join(" ")}
          >
            {page.label}
          </Link>
        );
      })}
    </nav>
  );
}
