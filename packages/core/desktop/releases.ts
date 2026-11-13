/**
 * Desktop app releases on GitHub. Desktop releases are tagged `desktop-vX.Y.Z`
 * (.github/workflows/desktop-release.yml) and share the release list with the website's
 * semantic-release releases (vX.Y.Z), so GitHub's "latest" cannot be used: the list is searched.
 * Used by the website's /download page and by the desktop app's update check.
 */

export const GITHUB_REPO = "SebastianFoder/fm-scoutreporter";
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;
/** The release list from GitHub's API (newest first). The website caches this request. */
export const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50&page=1`;
/** Where release files are downloaded from; the app downloads updates from nowhere else. */
export const RELEASE_DOWNLOAD_PREFIX = `${REPO_URL}/releases/download/desktop-v`;
/**
 * Every desktop release, newest first. GitHub's release search matches titles and notes, not tags,
 * so it searches for the desktop releases' title ("Scout Reporter desktop X.Y.Z").
 */
export const DESKTOP_RELEASES_URL = `${REPO_URL}/releases?q=%22Scout+Reporter+desktop%22&expanded=true`;

export interface DesktopRelease {
  version: string;
  /** The release page (notes and checksum). */
  pageUrl: string;
  /** The installer itself. */
  downloadUrl: string;
  fileName: string;
  bytes: number;
  /** SHA256SUMS.txt, when the release has one. */
  checksumsUrl: string | null;
  /** ISO date. */
  publishedAt: string;
}

interface GitHubAsset {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
}

interface GitHubRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

/** The newest published, non-pre-release desktop release with an installer, from GitHub's list. */
export function pickDesktopRelease(list: unknown): DesktopRelease | null {
  if (!Array.isArray(list)) return null;
  for (const r of list as GitHubRelease[]) {
    if (typeof r?.tag_name !== "string" || !r.tag_name.startsWith("desktop-v") || r.draft || r.prerelease) continue;
    const assets = Array.isArray(r.assets) ? (r.assets as GitHubAsset[]) : [];
    const installer = assets.find((a) => typeof a.name === "string" && /\.exe$/i.test(a.name));
    if (!installer || typeof installer.browser_download_url !== "string") continue;
    const sums = assets.find((a) => a.name === "SHA256SUMS.txt" && typeof a.browser_download_url === "string");
    return {
      version: r.tag_name.slice("desktop-v".length),
      pageUrl: typeof r.html_url === "string" ? r.html_url : DESKTOP_RELEASES_URL,
      downloadUrl: installer.browser_download_url,
      fileName: String(installer.name),
      bytes: typeof installer.size === "number" ? installer.size : 0,
      checksumsUrl: sums ? String(sums.browser_download_url) : null,
      publishedAt: typeof r.published_at === "string" ? r.published_at : "",
    };
  }
  return null;
}

/**
 * Compare two versions (X.Y.Z, optionally with a pre-release suffix such as 0.3.0-beta.1, which
 * sorts before 0.3.0): negative when a is older than b, 0 when equal, positive when newer.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre = ""] = v.trim().replace(/^v/, "").split("-", 2);
    const nums = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
    return { nums: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** The SHA-256 (lower-case hex) listed for `fileName` in a SHA256SUMS.txt, or null. */
export function checksumFor(sums: string, fileName: string): string | null {
  for (const line of sums.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (m && m[2] === fileName) return m[1].toLowerCase();
  }
  return null;
}
