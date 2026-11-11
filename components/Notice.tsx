import { AlertTriangle } from "lucide-react";

/** Warning notice: icon and text on a light gold tint. */
export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-md border border-gold bg-gold/12 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted">{children}</p>
      </div>
    </div>
  );
}
