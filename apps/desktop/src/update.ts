/**
 * Updates: find the newest desktop release on GitHub, download its installer, check it against the
 * release's SHA256SUMS.txt, and start it silently. No Electron imports, so it is unit-tested.
 *
 * The installer (NSIS, per user) replaces the program files only. Settings, scans and everything the
 * pages store (weights, highlights, formations) live in the user data folder, which an update never
 * touches. `/S` installs without the wizard into the existing install folder, and `--force-run` starts
 * the app again when it is done.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  checksumFor,
  pickDesktopRelease,
  RELEASE_DOWNLOAD_PREFIX,
  RELEASES_API_URL,
  type DesktopRelease,
} from "@scoutreporter/core/desktop/releases";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** The newest desktop release, or null when there is none. Throws when GitHub cannot be asked. */
export async function findLatestRelease(fetchImpl: Fetch, userAgent: string): Promise<DesktopRelease | null> {
  const res = await fetchImpl(RELEASES_API_URL, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": userAgent },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return pickDesktopRelease(await res.json());
}

/**
 * Download the release's installer into `dir` and check its SHA-256 against the release's
 * SHA256SUMS.txt. Returns the installer's path; throws (and leaves nothing behind) when anything is
 * off. Only files from this project's desktop releases are accepted.
 */
export async function downloadInstaller(
  release: DesktopRelease,
  dir: string,
  fetchImpl: Fetch,
  onProgress: (share: number) => void = () => {},
): Promise<string> {
  if (!release.downloadUrl.startsWith(RELEASE_DOWNLOAD_PREFIX) || !/^[\w.-]+\.exe$/.test(release.fileName)) {
    throw new Error("the update is not one of Scout Reporter's releases");
  }
  if (!release.checksumsUrl?.startsWith(RELEASE_DOWNLOAD_PREFIX)) throw new Error("the release has no checksum to check the download against");
  const sumsRes = await fetchImpl(release.checksumsUrl);
  if (!sumsRes.ok) throw new Error(`the checksum file could not be downloaded (${sumsRes.status})`);
  const expected = checksumFor(await sumsRes.text(), release.fileName);
  if (!expected) throw new Error("the release's checksum file does not list the installer");

  const res = await fetchImpl(release.downloadUrl);
  if (!res.ok || !res.body) throw new Error(`the installer could not be downloaded (${res.status})`);
  const total = Number(res.headers.get("content-length")) || release.bytes || 0;

  await mkdir(dir, { recursive: true });
  const file = join(dir, release.fileName);
  const part = `${file}.part`;
  const hash = createHash("sha256");
  const out = await open(part, "w");
  let received = 0;
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      await out.write(chunk);
      received += chunk.byteLength;
      if (total > 0) onProgress(Math.min(1, received / total));
    }
  } catch (e) {
    await out.close();
    await rm(part, { force: true });
    throw e;
  }
  await out.close();
  if (hash.digest("hex") !== expected) {
    await rm(part, { force: true });
    throw new Error("the download does not match the release's checksum, so it was not installed");
  }
  await rename(part, file);
  return file;
}

/** Start the installer silently, detached, so it can replace the app once the app has closed. */
export function startInstaller(file: string, spawnImpl: typeof spawn = spawn) {
  const child = spawnImpl(file, ["/S", "--force-run"], { detached: true, stdio: "ignore" });
  child.unref();
}
