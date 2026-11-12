/**
 * Serves the website's screens inside the app: the Next.js standalone server built for the desktop
 * target (apps/web, SCOUTREPORTER_TARGET=desktop), run in an Electron utility process on 127.0.0.1
 * and a random free port. In development it points at `next dev` instead (SR_DEV_URL).
 */
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { utilityProcess, type UtilityProcess } from "electron";

export interface WebServer {
  origin: string;
  stop(): void;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(origin: string, child: UtilityProcess, timeoutMs = 30_000): Promise<void> {
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error("The app's page server stopped while starting.");
    try {
      const res = await fetch(`${origin}/manifest.webmanifest`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("The app's page server did not start in time.");
}

/** Start the bundled Next server from `standaloneDir` (resources/web in the installed app). */
export async function startWebServer(standaloneDir: string): Promise<WebServer> {
  const devUrl = process.env.SR_DEV_URL;
  if (devUrl) return { origin: new URL(devUrl).origin, stop: () => {} };

  const serverJs = join(standaloneDir, "apps", "web", "server.js");
  if (!existsSync(serverJs)) throw new Error(`The app's pages are missing (${serverJs}). Reinstall Scout Reporter.`);
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = utilityProcess.fork(serverJs, [], {
    serviceName: "Scout Reporter pages",
    stdio: "ignore",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  await waitForServer(origin, child);
  return { origin, stop: () => child.kill() };
}
