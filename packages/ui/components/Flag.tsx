import type { ReactNode } from "react";
import type { FlagCode } from "../i18n/locales";

/*
 * Small flags for the language picker, drawn as SVG: Windows has no emoji flags (it shows the
 * letters instead), and the desktop app is Windows only. All are drawn in a 3:2 box and simplified
 * where the real flag has detail too small to see at 20px (Spain's arms, Korea's trigrams).
 */
const W = 30;
const H = 20;

/** A Nordic cross: the upright sits left of centre. */
function nordic(field: string, cross: string, inner?: string): ReactNode {
  return (
    <>
      <rect width={W} height={H} fill={field} />
      <rect x={8} width={6} height={H} fill={cross} />
      <rect y={7} width={W} height={6} fill={cross} />
      {inner && (
        <>
          <rect x={9.5} width={3} height={H} fill={inner} />
          <rect y={8.5} width={W} height={3} fill={inner} />
        </>
      )}
    </>
  );
}

const vertical = (a: string, b: string, c: string) => (
  <>
    <rect width={10} height={H} fill={a} />
    <rect x={10} width={10} height={H} fill={b} />
    <rect x={20} width={10} height={H} fill={c} />
  </>
);

const horizontal = (a: string, b: string, c: string) => (
  <>
    <rect width={W} height={7} fill={a} />
    <rect y={6.67} width={W} height={6.67} fill={b} />
    <rect y={13.33} width={W} height={6.67} fill={c} />
  </>
);

/** One trigram of the Korean flag: three bars, `broken` ones split in the middle. */
function trigram(cx: number, cy: number, angle: number, broken: [boolean, boolean, boolean]) {
  return (
    <g transform={`rotate(${angle} ${cx} ${cy})`} fill="#000">
      {broken.map((split, i) => {
        const y = cy - 2 + i * 1.6;
        return split ? (
          <g key={i}>
            <rect x={cx - 2.5} y={y} width={2.1} height={1} />
            <rect x={cx + 0.4} y={y} width={2.1} height={1} />
          </g>
        ) : (
          <rect key={i} x={cx - 2.5} y={y} width={5} height={1} />
        );
      })}
    </g>
  );
}

const FLAGS: Record<FlagCode, ReactNode> = {
  gb: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth={4} />
      <path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" strokeWidth={1.6} />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth={6} />
      <path d="M15 0V20M0 10H30" stroke="#C8102E" strokeWidth={3.4} />
    </>
  ),
  fr: vertical("#0055A4", "#fff", "#EF4135"),
  it: vertical("#009246", "#fff", "#CE2B37"),
  de: horizontal("#000", "#DD0000", "#FFCE00"),
  es: (
    <>
      <rect width={W} height={H} fill="#AA151B" />
      <rect y={5} width={W} height={10} fill="#F1BF00" />
    </>
  ),
  dk: nordic("#C8102E", "#fff"),
  se: nordic("#006AA7", "#FECC02"),
  no: nordic("#BA0C2F", "#fff", "#00205B"),
  kr: (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={15} cy={10} r={5} fill="#003478" />
      <path d="M10 10A5 5 0 0 1 20 10A2.5 2.5 0 0 1 15 10A2.5 2.5 0 0 0 10 10Z" fill="#C60C30" transform="rotate(33.7 15 10)" />
      {trigram(6, 4.5, -56.3, [false, false, false])}
      {trigram(24, 15.5, -56.3, [true, true, true])}
      {trigram(24, 4.5, 56.3, [false, true, false])}
      {trigram(6, 15.5, 56.3, [true, false, true])}
    </>
  ),
};

export function Flag({ code, className = "h-3.5 w-5" }: { code: FlagCode; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/15 ${className}`}
      aria-hidden
    >
      {FLAGS[code]}
    </svg>
  );
}
