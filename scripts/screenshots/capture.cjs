/**
 * Electron main script for scripts/screenshots/screenshots.mjs: opens each Storybook story, waits
 * until it has rendered, and saves a PNG. Size and pixel density are set through the DevTools
 * protocol (device metrics), so the pictures do not depend on this PC's display scaling. The job
 * comes in SR_SHOTS (JSON): { base, outDir, width, height, scale, settleMs, shots: [{ name, id, theme, height? }] }.
 */
const { app, BrowserWindow } = require("electron");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const job = JSON.parse(process.env.SR_SHOTS || "{}");
app.commandLine.appendSwitch("hide-scrollbars");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  mkdirSync(job.outDir, { recursive: true });
  const win = new BrowserWindow({
    width: job.width,
    height: job.height,
    // Shown (a hidden window may never draw a frame to capture), but invisible and out of the way.
    show: false,
    opacity: 0,
    skipTaskbar: true,
    focusable: false,
    frame: false,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false },
  });
  win.showInactive();
  // The DevTools commands need a page to act on.
  await win.loadURL("about:blank");
  const cdp = win.webContents.debugger;
  cdp.attach("1.3");
  const metrics = (height) =>
    cdp.sendCommand("Emulation.setDeviceMetricsOverride", { width: job.width, height, deviceScaleFactor: job.scale || 1, mobile: false });
  await metrics(job.height);

  let failed = 0;
  for (const shot of job.shots) {
    const label = `${shot.name}-${shot.theme}`;
    try {
      const url = `${job.base}/iframe.html?id=${encodeURIComponent(shot.id)}&viewMode=story&globals=theme:${shot.theme}`;
      // A screen whose content ends early gets a shorter picture (shot.height, CSS pixels).
      await metrics(shot.height || job.height);
      await win.loadURL(url);
      // Rendered: Storybook shows the story (not its error screen) and the root has content.
      let ready = false;
      for (let i = 0; i < 150 && !ready; i++) {
        ready = await win.webContents.executeJavaScript(
          `document.body.classList.contains("sb-show-main") && !!document.querySelector("#storybook-root")?.children.length`,
        );
        if (!ready) await sleep(100);
      }
      if (!ready) throw new Error("the story did not render");
      // Providers import the fixtures and the screens score them after the first render.
      await sleep(job.settleMs || 2500);
      // A hidden window draws only when something changes: ask for a full redraw, and give up
      // rather than wait forever if no frame comes.
      win.webContents.invalidate();
      const { data } = await Promise.race([
        cdp.sendCommand("Page.captureScreenshot", { format: "png", fromSurface: true }),
        sleep(20000).then(() => { throw new Error("no frame to capture after 20 s"); }),
      ]);
      const file = join(job.outDir, `${label}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(`${label}.png`);
    } catch (e) {
      failed++;
      console.error(`${label}: ${e.message}`);
    }
  }
  cdp.detach();
  win.destroy();
  app.exit(failed ? 1 : 0);
});
