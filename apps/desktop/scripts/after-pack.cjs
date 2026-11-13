/**
 * electron-builder afterPack hook. electron-builder never copies node_modules folders as extra
 * resources, but the bundled Next.js server needs its traced node_modules: copy them in here,
 * before the installer is built.
 */
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

exports.default = async function afterPack(context) {
  const from = join(__dirname, "..", "..", "web", ".next-desktop", "standalone", "node_modules");
  const to = join(context.appOutDir, "resources", "web", "node_modules");
  if (!existsSync(from)) throw new Error(`Missing ${from}: run node scripts/build.mjs web first.`);
  cpSync(from, to, { recursive: true, dereference: true });
};
