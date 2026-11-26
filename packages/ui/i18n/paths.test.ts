import test from "node:test";
import assert from "node:assert/strict";
import { localePrefix, localizePath, localizedPaths, splitLocale, stripLocale } from "./paths";

test("English has no prefix; other languages do", () => {
  assert.equal(localePrefix("en"), "");
  assert.equal(localePrefix("da"), "/da");
  assert.equal(localePrefix("xx"), "");
});

test("site paths get the language; other hrefs are left alone", () => {
  assert.equal(localizePath("/players", "da"), "/da/players");
  assert.equal(localizePath("/", "da"), "/da");
  assert.equal(localizePath("/?ids=1", "ko"), "/ko?ids=1");
  assert.equal(localizePath("/#modes", "fr"), "/fr#modes");
  assert.equal(localizePath("/players/compare?ids=1,2", "de"), "/de/players/compare?ids=1,2");
  assert.equal(localizePath("/players", "en"), "/players");
  assert.equal(localizePath("https://github.com", "da"), "https://github.com");
  assert.equal(localizePath("//cdn.example.com/x", "da"), "//cdn.example.com/x");
  assert.equal(localizePath("#top", "da"), "#top");
  assert.equal(localizePath("/SCOUT REPORTER Standard.fmf", "en"), "/SCOUT REPORTER Standard.fmf");
});

test("the language prefix is split off the path", () => {
  assert.deepEqual(splitLocale("/da/players"), { locale: "da", path: "/players" });
  assert.deepEqual(splitLocale("/da"), { locale: "da", path: "/" });
  assert.deepEqual(splitLocale("/en/faq"), { locale: "en", path: "/faq" });
  assert.deepEqual(splitLocale("/players"), { locale: null, path: "/players" });
  assert.deepEqual(splitLocale("/"), { locale: null, path: "/" });
  assert.deepEqual(splitLocale("/download"), { locale: null, path: "/download" });
  assert.deepEqual(splitLocale("/danish"), { locale: null, path: "/danish" });
  assert.equal(stripLocale("/ko/staff/backroom"), "/staff/backroom");
});

test("every language's URL for a page", () => {
  const paths = localizedPaths("/faq");
  assert.equal(paths.en, "/faq");
  assert.equal(paths.nb, "/nb/faq");
  assert.equal(Object.keys(paths).length, 9);
});
