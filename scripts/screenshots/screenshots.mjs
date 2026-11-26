#!/usr/bin/env node
/**
 * Screenshots of the app for the README and the website, taken from Storybook: every main screen
 * has a story with sample players, so the pictures can be made again whenever the screens change.
 *
 *   bun run screenshots              # build Storybook, then capture
 *   bun run screenshots -- --no-build   # use the existing storybook-static/
 *   bun run screenshots -- --only best-xi,squad
 *   bun run screenshots -- --locales en,fr
 *   bun run screenshots -- --index-only   # only rewrite the image index from what is on disk
 *
 * Every screen in every language (packages/ui/i18n/locales.ts) and theme. English goes in
 * apps/web/public/screenshots/<name>-light.png and <name>-dark.png, which the README shows through
 * <picture> (light or dark to match GitHub's theme); other languages in screenshots/<locale>/.
 * Then it rewrites apps/web/lib/screenshot-images.ts, which imports every picture there is, so the
 * website shows the visitor's language (English where a language has none).
 */
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const staticDir = join(root, "storybook-static");
const outDir = join(root, "apps", "web", "public", "screenshots");
const args = process.argv.slice(2);
const listArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? new Set(args[i + 1].split(",")) : null;
};
const only = listArg("--only");
/** The languages, read from the app's list so a new language gets screenshots without editing this. */
const ALL_LOCALES = [...readFileSync(join(root, "packages", "ui", "i18n", "locales.ts"), "utf8")
  .match(/export const LOCALES = \[([^\]]+)\]/)[1]
  .matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
const LOCALES = [...(listArg("--locales") ?? ALL_LOCALES)];

/**
 * The screens shown. `name` is the file name, `id` the Storybook story, `height` a shorter capture
 * (CSS pixels, default 800) for a screen whose content ends early. Titles and captions for the
 * website are in apps/web/lib/screenshots.ts; keep the names in step.
 */
export const SCREENS = [
  { name: "players", id: "pages-players--squad-import" },
  { name: "player", id: "components-playerpanel--open-outfield" },
  { name: "best-xi", id: "pages-best-xi--imported" },
  { name: "squad", id: "pages-squad-analysis--hidden-attributes" },
  { name: "staff", id: "pages-staff--rank-by-role" },
  { name: "backroom", id: "pages-best-backroom--full-backroom" },
];
const THEMES = process.env.SR_THEMES ? process.env.SR_THEMES.split(",") : ["light", "dark"];

if (args.includes("--index-only")) {
  writeImageIndex();
  process.exit(0);
}

if (!args.includes("--no-build") || !existsSync(join(staticDir, "iframe.html"))) {
  console.log("Building Storybook...");
  const res = spawnSync("bun", ["run", "build-storybook"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".csv": "text/csv" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(staticDir, path));
  if (!file.startsWith(staticDir)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const shots = SCREENS.filter((s) => !only || only.has(s.name)).flatMap((s) =>
  LOCALES.flatMap((locale) => THEMES.map((theme) => ({ ...s, theme, locale }))),
);
const electron = createRequire(join(root, "apps", "desktop", "package.json"))("electron");
const job = { base, outDir, width: 1280, height: 800, scale: 2, settleMs: 2500, shots };
const env = { ...process.env, SR_SHOTS: JSON.stringify(job) };
delete env.ELECTRON_RUN_AS_NODE; // set, even empty, it makes Electron plain Node
const child = spawn(electron, [join(root, "scripts", "screenshots", "capture.cjs")], {
  stdio: "inherit",
  env,
});
child.on("exit", (code) => {
  server.close();
  writeImageIndex();
  process.exit(code ?? 1);
});

/**
 * apps/web/lib/screenshot-images.ts: a static import of every screenshot on disk, by language,
 * screen and theme. Imported (not linked) so Next knows each picture's size and serves it under a
 * content-hashed URL.
 */
function writeImageIndex() {
  const ident = (...parts) =>
    parts.join("-").replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const imports = [];
  const entries = [];
  for (const locale of ALL_LOCALES) {
    const dir = locale === "en" ? "" : `${locale}/`;
    const screens = [];
    for (const { name } of SCREENS) {
      const themes = ["light", "dark"];
      // A screen counts only with both pictures; else the site falls back to English for it.
      if (!themes.every((theme) => existsSync(join(outDir, `${dir}${name}-${theme}.png`)))) continue;
      const ids = themes.map((theme) => {
        const id = ident(locale, name, theme);
        imports.push(`import ${id} from "../public/screenshots/${dir}${name}-${theme}.png";`);
        return `${theme}: ${id}`;
      });
      screens.push(`    "${name}": { ${ids.join(", ")} },`);
    }
    if (screens.length) entries.push([`  ${locale}: {`, ...screens, "  },"].join("\n"));
  }
  const source = [
    "/* Generated by scripts/screenshots (bun run screenshots). Do not edit. */",
    'import type { StaticImageData } from "next/image";',
    ...imports,
    "",
    "/** Screenshots by language, then screen name: the light and the dark picture. */",
    "export const SCREENSHOT_IMAGES: Partial<Record<string, Record<string, { light: StaticImageData; dark: StaticImageData }>>> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
  writeFileSync(join(root, "apps", "web", "lib", "screenshot-images.ts"), source);
  console.log("Wrote apps/web/lib/screenshot-images.ts");
}
