import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[oklch(var(--background))] text-[oklch(var(--text))]">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tight">
            Scout Reporter Modes
          </h1>
          <p className="max-w-2xl text-sm text-[oklch(var(--text))/0.75]">
            Choose a mode to continue. Attribute mode scores and compares players
            from attribute exports.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--surface))] px-6 py-5 shadow-[4px_4px_0_oklch(var(--border))]">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              Attribute Mode
            </h2>
            <p className="mt-2 text-sm text-[oklch(var(--text))/0.8]">
              Import CSV exports, tune weights, and compare players by
              attributes.
            </p>
            <div className="mt-4">
              <Link
                href="/attribute"
                className="inline-flex rounded-lg border-2 border-[oklch(var(--border))] bg-[oklch(var(--primary))] px-4 py-2 text-sm font-bold text-[oklch(var(--background))] shadow-[2px_2px_0_oklch(var(--border))] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_oklch(var(--border))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Open Attribute Mode
              </Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
