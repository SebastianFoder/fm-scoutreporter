/**
 * True in the desktop app's build of the pages (SCOUTREPORTER_TARGET=desktop, passed in by
 * apps/web/next.config.ts). Known while rendering on the server too, unlike the desktop bridge, so
 * desktop-only differences never flash on first paint. False on the website and in Storybook.
 */
export const DESKTOP_BUILD: boolean = (() => {
  try {
    // Next replaces this expression with the value at build time; Storybook has no `process`.
    return process.env.SCOUTREPORTER_TARGET === "desktop";
  } catch {
    return false;
  }
})();
