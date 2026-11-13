/**
 * The newest desktop app release on GitHub, for the /download page. Desktop releases are tagged
 * `desktop-vX.Y.Z` (.github/workflows/desktop-release.yml) and share the release list with the
 * website's semantic-release releases (vX.Y.Z), so "latest" cannot be used: the list is searched.
 */

export const GITHUB_REPO = "SebastianFoder/fm-scoutreporter";
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;
/** Every desktop release, newest first. */
export const DESKTOP_RELEASES_URL = `${REPO_URL}/releases?q=desktop-v&expanded=true`;

export interface DesktopRelease {
  version: string;
  /** The release page. */
  pageUrl: string;
  /** The installer itself. */
  downloadUrl: string;
  fileName: string;
  bytes: number;
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
    return {
      version: r.tag_name.slice("desktop-v".length),
      pageUrl: typeof r.html_url === "string" ? r.html_url : DESKTOP_RELEASES_URL,
      downloadUrl: installer.browser_download_url,
      fileName: String(installer.name),
      bytes: typeof installer.size === "number" ? installer.size : 0,
      publishedAt: typeof r.published_at === "string" ? r.published_at : "",
    };
  }
  return null;
}

/**
 * Asks GitHub (cached for an hour, so the anonymous rate limit is never near). Null when there is
 * no desktop release yet, or GitHub cannot be reached: the page then links to the release list.
 */
export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return pickDesktopRelease(await res.json());
  } catch {
    return null;
  }
}
