/**
 * The app screenshots shown on the website, made from Storybook by scripts/screenshots (bun run
 * screenshots) in every language and theme. The pictures themselves are in the generated
 * screenshot-images.ts; <Screenshot> picks the visitor's language, falling back to English.
 */
export interface ScreenshotInfo {
  name: string;
  /** Its title and caption are home.screenshots.<key>.title / .caption. */
  key: "squad" | "players" | "bestXi" | "player" | "staff" | "backroom";
  href: string;
}

export const SCREENSHOTS: ScreenshotInfo[] = [
  { name: "squad", key: "squad", href: "/squad" },
  { name: "players", key: "players", href: "/players" },
  { name: "best-xi", key: "bestXi", href: "/players/best-xi" },
  { name: "player", key: "player", href: "/players" },
  { name: "staff", key: "staff", href: "/staff" },
  { name: "backroom", key: "backroom", href: "/staff/backroom" },
];

export function screenshot(name: string): ScreenshotInfo {
  const shot = SCREENSHOTS.find((s) => s.name === name);
  if (!shot) throw new Error(`No screenshot "${name}"`);
  return shot;
}
