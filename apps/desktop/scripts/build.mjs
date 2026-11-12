/**
 * Build steps for the desktop app (run from the repo root through the root scripts):
 *
 *   node apps/desktop/scripts/build.mjs main     bundle src/main.ts and src/preload.ts into dist/
 *   node apps/desktop/scripts/build.mjs web      build apps/web for the desktop target (standalone server)
 *   node apps/desktop/scripts/build.mjs electron download Electron's binary if missing
 *   node apps/desktop/scripts/build.mjs all      reader, web, main (what the installer needs)
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopDir, "..", "..");
const webDir = join(repoRoot, "apps", "web");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) {
    console.error(`\n${cmd} ${args.join(" ")} failed (exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
}

function buildMain() {
  rmSync(join(desktopDir, "dist"), { recursive: true, force: true });
  for (const entry of ["main", "preload"]) {
    run("bun", [
      "build",
      join(desktopDir, "src", `${entry}.ts`),
      "--target=node",
      "--format=cjs",
      "--external=electron",
      `--outfile=${join(desktopDir, "dist", `${entry}.js`)}`,
    ]);
  }
}

function buildWeb() {
  const out = join(webDir, ".next-desktop");
  rmSync(out, { recursive: true, force: true });
  run("bun", ["run", "build"], {
    cwd: webDir,
    env: { ...process.env, SCOUTREPORTER_TARGET: "desktop", NEXT_TELEMETRY_DISABLED: "1" },
  });
  // A standalone server serves neither the static chunks nor public/ itself: copy them next to it.
  const appDir = join(out, "standalone", "apps", "web");
  if (!existsSync(join(appDir, "server.js"))) {
    console.error(`No standalone server at ${appDir}. Did the desktop build run with output: "standalone"?`);
    process.exit(1);
  }
  cpSync(join(out, "static"), join(appDir, ".next-desktop", "static"), { recursive: true });
  cpSync(join(webDir, "public"), join(appDir, "public"), { recursive: true });
}

function ensureElectron() {
  const pkg = join(repoRoot, "node_modules", "electron");
  if (!existsSync(join(pkg, "dist"))) run("node", [join(pkg, "install.js")]);
}

const step = process.argv[2] ?? "all";
if (step === "main") buildMain();
else if (step === "web") buildWeb();
else if (step === "electron") ensureElectron();
else if (step === "all") {
  run("dotnet", ["publish", join(repoRoot, "reader", "ScoutReporter.Reader.csproj"), "-c", "Release"]);
  buildWeb();
  buildMain();
} else {
  console.error(`Unknown step "${step}". Use main, web, electron or all.`);
  process.exit(64);
}
