import type { ReactNode } from "react";

/** Page title row: title, one-line description, optional actions on the right. */
export function PageHeader({
  title,
  children,
  aside,
}: {
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.6rem] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
        {children && <div className="mt-1 max-w-3xl text-[15px] text-muted">{children}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
