/**
 * Scout Reporter mark: a pitch seen from above, with one position marked:
 * the thing a scout report is about. Keep in sync with app/icon.svg.
 */
export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <rect x="2.5" y="1.5" width="19" height="21" rx="2" fill="oklch(0.5 0.12 150)" />
      <g fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.2">
        <rect x="2.5" y="1.5" width="19" height="21" rx="2" />
        <line x1="2.5" y1="12" x2="21.5" y2="12" />
        <circle cx="12" cy="12" r="3" />
        <rect x="7.5" y="1.5" width="9" height="4" />
        <rect x="7.5" y="18.5" width="9" height="4" />
      </g>
      <circle cx="16" cy="7.5" r="2.1" fill="white" />
    </svg>
  );
}
