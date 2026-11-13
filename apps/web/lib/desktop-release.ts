/**
 * The newest desktop app release on GitHub, for the /download page. The release logic is shared
 * with the desktop app's update check (packages/core/desktop/releases.ts).
 */
import { pickDesktopRelease, RELEASES_API_URL, type DesktopRelease } from "@scoutreporter/core/desktop/releases";

export { DESKTOP_RELEASES_URL, REPO_URL, GITHUB_REPO, pickDesktopRelease, type DesktopRelease } from "@scoutreporter/core/desktop/releases";

/** How often (seconds) the newest release is looked up: a new release shows within this time. */
export const RELEASE_CHECK_SECONDS = 600;

/**
 * Asks GitHub, cached for RELEASE_CHECK_SECONDS (six requests an hour, far below the anonymous
 * limit of 60). Null when there is no desktop release yet, or GitHub cannot be reached: the page then
 * links to the release list. The cached answer outlives deployments, so changing the request (URL
 * or headers) is what makes a deployment ask GitHub afresh.
 */
export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  try {
    const res = await fetch(RELEASES_API_URL, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      next: { revalidate: RELEASE_CHECK_SECONDS },
    });
    if (!res.ok) return null;
    return pickDesktopRelease(await res.json());
  } catch {
    return null;
  }
}
