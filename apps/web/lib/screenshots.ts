/**
 * The app screenshots in public/screenshots, made from Storybook by scripts/screenshots (bun run
 * screenshots): `<name>-light.png` and `<name>-dark.png`. They are imported, so Next knows their
 * sizes and serves them under a content-hashed URL: new pictures are never mixed up with cached ones.
 */
import type { StaticImageData } from "next/image";
import backroomDark from "../public/screenshots/backroom-dark.png";
import backroomLight from "../public/screenshots/backroom-light.png";
import bestXiDark from "../public/screenshots/best-xi-dark.png";
import bestXiLight from "../public/screenshots/best-xi-light.png";
import playerDark from "../public/screenshots/player-dark.png";
import playerLight from "../public/screenshots/player-light.png";
import playersDark from "../public/screenshots/players-dark.png";
import playersLight from "../public/screenshots/players-light.png";
import squadDark from "../public/screenshots/squad-dark.png";
import squadLight from "../public/screenshots/squad-light.png";
import staffDark from "../public/screenshots/staff-dark.png";
import staffLight from "../public/screenshots/staff-light.png";
import wonderkidDark from "../public/screenshots/wonderkid-dark.png";
import wonderkidLight from "../public/screenshots/wonderkid-light.png";

export interface ScreenshotInfo {
  name: string;
  title: string;
  caption: string;
  href: string;
  light: StaticImageData;
  dark: StaticImageData;
}

export const SCREENSHOTS: ScreenshotInfo[] = [
  { name: "squad", title: "Squad analysis", caption: "Your first and second eleven, thin cover, weak links and who should start.", href: "/squad", light: squadLight, dark: squadDark },
  { name: "players", title: "Player list", caption: "Every player scored on your weights or an FM27 role, with grades, vs-age and value.", href: "/players", light: playersLight, dark: playersDark },
  { name: "wonderkid", title: "Wonderkids", caption: "Prospects ranked on what they could become at full potential.", href: "/players?view=wonderkids", light: wonderkidLight, dark: wonderkidDark },
  { name: "best-xi", title: "Best XI", caption: "The best eleven for any formation, within a transfer budget.", href: "/players/best-xi", light: bestXiLight, dark: bestXiDark },
  { name: "player", title: "Player panel", caption: "Click any player for their profile, CA, PA and attributes in a side panel.", href: "/players", light: playerLight, dark: playerDark },
  { name: "staff", title: "Staff", caption: "Coaches, scouts and directors scored on 17 staff roles.", href: "/staff", light: staffLight, dark: staffDark },
  { name: "backroom", title: "Best backroom", caption: "The staff to hire for every role, nobody used twice.", href: "/staff/backroom", light: backroomLight, dark: backroomDark },
];

export function screenshot(name: string): ScreenshotInfo {
  const shot = SCREENSHOTS.find((s) => s.name === name);
  if (!shot) throw new Error(`No screenshot "${name}"`);
  return shot;
}
