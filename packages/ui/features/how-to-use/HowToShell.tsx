import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@scoutreporter/ui/components/PageHeader";
import { HowToTabs } from "./HowToTabs";

/** Layout shared by the how-to pages: title row, guide tabs, then the guide in a panel. */
export function HowToShell({
  title,
  description,
  link,
  children,
}: {
  title: string;
  description: ReactNode;
  link: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="text-ink">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-6 md:py-8">
        <PageHeader title={title}>
          {description}{" "}
          <Link href={link.href} className="link">
            {link.label}
          </Link>
        </PageHeader>
        <HowToTabs />
        <div className="panel overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
