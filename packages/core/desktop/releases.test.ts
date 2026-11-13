import test from "node:test";
import assert from "node:assert/strict";
import { checksumFor, compareVersions, pickDesktopRelease } from "./releases";

const exe = (version: string) => ({
  name: `Scout-Reporter-Setup-${version}.exe`,
  browser_download_url: `https://github.com/x/y/releases/download/desktop-v${version}/Scout-Reporter-Setup-${version}.exe`,
  size: 134_000_000,
});
const sums = { name: "SHA256SUMS.txt", browser_download_url: "https://example.test/sums", size: 90 };

test("picks the newest desktop release with an installer, skipping website releases", () => {
  const list = [
    { tag_name: "v1.16.0", html_url: "https://github.com/x/y/releases/tag/v1.16.0", assets: [] },
    { tag_name: "desktop-v0.3.0-beta.1", prerelease: true, assets: [exe("0.3.0-beta.1")] },
    { tag_name: "desktop-v0.2.1", draft: true, assets: [exe("0.2.1")] },
    { tag_name: "desktop-v0.2.0", html_url: "https://github.com/x/y/releases/tag/desktop-v0.2.0", published_at: "2026-11-20T10:00:00Z", assets: [sums, exe("0.2.0")] },
    { tag_name: "desktop-v0.1.0", assets: [exe("0.1.0")] },
  ];
  const r = pickDesktopRelease(list);
  assert.equal(r?.version, "0.2.0");
  assert.equal(r?.fileName, "Scout-Reporter-Setup-0.2.0.exe");
  assert.equal(r?.pageUrl, "https://github.com/x/y/releases/tag/desktop-v0.2.0");
  assert.equal(r?.bytes, 134_000_000);
  assert.equal(r?.publishedAt, "2026-11-20T10:00:00Z");
  assert.equal(r?.checksumsUrl, "https://example.test/sums");
  assert.equal(pickDesktopRelease([{ tag_name: "desktop-v0.1.0", assets: [exe("0.1.0")] }])?.checksumsUrl, null);
});

test("no desktop release, an upload still running, or a bad answer gives null", () => {
  assert.equal(pickDesktopRelease([{ tag_name: "v1.15.0", assets: [] }]), null);
  assert.equal(pickDesktopRelease([{ tag_name: "desktop-v0.1.0", assets: [sums] }]), null);
  assert.equal(pickDesktopRelease({ message: "API rate limit exceeded" }), null);
  assert.equal(pickDesktopRelease(null), null);
});

test("versions compare by number, and a pre-release comes before its release", () => {
  assert.ok(compareVersions("0.2.0", "0.10.0") < 0);
  assert.ok(compareVersions("1.0.0", "0.99.99") > 0);
  assert.equal(compareVersions("0.2.0", "0.2.0"), 0);
  assert.equal(compareVersions("v0.2.0", "0.2.0"), 0);
  assert.ok(compareVersions("0.3.0-beta.1", "0.3.0") < 0);
  assert.ok(compareVersions("0.3.0-beta.2", "0.3.0-beta.1") > 0);
  assert.ok(compareVersions("0.3.0-beta.1", "0.2.9") > 0);
});

test("the checksum for a file is read from SHA256SUMS.txt", () => {
  const a = "7809157782dc558ce285a7583535875d34d9490e5de50c0cbeea12b150b3a51f";
  const b = "A".repeat(64);
  const file = `${a}  Scout-Reporter-Setup-0.1.0.exe\r\n${b} *Other.exe\n`;
  assert.equal(checksumFor(file, "Scout-Reporter-Setup-0.1.0.exe"), a);
  assert.equal(checksumFor(file, "Other.exe"), "a".repeat(64));
  assert.equal(checksumFor(file, "Scout-Reporter-Setup-0.2.0.exe"), null);
  assert.equal(checksumFor("not a checksum file", "x.exe"), null);
});
