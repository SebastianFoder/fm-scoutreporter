import test from "node:test";
import assert from "node:assert/strict";
import { UMAMI_BEFORE_SEND, anonymiseIds, stripLocalePrefix, umamiBeforeSendScript } from "./umami";

test("player IDs in page URLs become [id]; named pages stay", () => {
  assert.equal(anonymiseIds("/players/2002083882"), "/players/[id]");
  assert.equal(anonymiseIds("https://fmscouting.sebastianfoder.com/players/2002083882?tab=1"), "https://fmscouting.sebastianfoder.com/players/[id]?tab=1");
  assert.equal(anonymiseIds("scoutreporter://app/players/2002083882#stats"), "scoutreporter://app/players/[id]#stats");
  assert.equal(anonymiseIds("/players/compare"), "/players/compare");
  assert.equal(anonymiseIds("/players/best-xi"), "/players/best-xi");
  assert.equal(anonymiseIds("/players?id=2002083882"), "/players?id=2002083882");
});

test("the inline before-send script rewrites the url and referrer the tracker passes", () => {
  const win: Record<string, (type: string, payload: Record<string, string>) => unknown> = {};
  new Function("window", umamiBeforeSendScript())(win);
  const payload = { url: "/players/2002083882", referrer: "https://fmscouting.sebastianfoder.com/players/123456", website: "x" };
  assert.deepEqual(win[UMAMI_BEFORE_SEND]("event", payload), {
    url: "/players/[id]",
    referrer: "https://fmscouting.sebastianfoder.com/players/[id]",
    website: "x",
  });
});

const PREFIXED = ["fr", "de", "da", "ko"];

test("the language prefix is dropped, so /da/players and /players are one page", () => {
  assert.equal(stripLocalePrefix("/da/players", PREFIXED), "/players");
  assert.equal(stripLocalePrefix("/da", PREFIXED), "/");
  assert.equal(stripLocalePrefix("/da?tab=1", PREFIXED), "/?tab=1");
  assert.equal(stripLocalePrefix("https://fmscouting.sebastianfoder.com/ko/players/best-xi#x", PREFIXED), "https://fmscouting.sebastianfoder.com/players/best-xi#x");
  assert.equal(stripLocalePrefix("https://fmscouting.sebastianfoder.com/de", PREFIXED), "https://fmscouting.sebastianfoder.com/");
  assert.equal(stripLocalePrefix("/players", PREFIXED), "/players");
  assert.equal(stripLocalePrefix("/download", PREFIXED), "/download");
  assert.equal(stripLocalePrefix("/danish-page", PREFIXED), "/danish-page");
  assert.equal(stripLocalePrefix("/players/da", PREFIXED), "/players/da");
});

test("the before-send script drops the language prefix from the page and same-site referrers only", () => {
  const win: Record<string, (type: string, payload: Record<string, string>) => unknown> = {};
  new Function("window", umamiBeforeSendScript(PREFIXED))(win);
  assert.deepEqual(
    win[UMAMI_BEFORE_SEND]("event", {
      url: "https://fmscouting.sebastianfoder.com/da/players/2002083882",
      referrer: "/fr/faq",
    }),
    { url: "https://fmscouting.sebastianfoder.com/players/[id]", referrer: "/faq" },
  );
  assert.deepEqual(
    win[UMAMI_BEFORE_SEND]("event", { url: "/de", referrer: "https://www.example.de/de/forum" }),
    { url: "/", referrer: "https://www.example.de/de/forum" },
  );
});
