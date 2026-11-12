/**
 * Desktop development: `next dev` for the desktop target on port 3210, then Electron pointed at it
 * (SR_DEV_URL), with the main process bundled first. Pages hot-reload; restart for main-process
 * changes. Scanning needs the reader: bun run reader:build.
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopDir, "..", "..");
const isWin = process.platform === "win32";
const port = 3210;
const url = `http://127.0.0.1:${port}`;

for (const step of ["electron", "main"]) {
  const res = spawnSync("node", [join(desktopDir, "scripts", "build.mjs"), step], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const next = spawn("bun", ["run", "dev", "--", "--port", String(port), "--hostname", "127.0.0.1"], {
  cwd: join(repoRoot, "apps", "web"),
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, SCOUTREPORTER_TARGET: "desktop", NEXT_TELEMETRY_DISABLED: "1" },
});

async function waitForNext() {
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(`${url}/desktop`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("next dev did not start");
}

await waitForNext();
const electronExe = (await import("electron")).default;
const app = spawn(electronExe, [desktopDir], { stdio: "inherit", env: { ...process.env, SR_DEV_URL: url } });
const stop = () => {
  app.kill();
  next.kill();
};
app.on("exit", () => {
  next.kill();
  process.exit(0);
});
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
