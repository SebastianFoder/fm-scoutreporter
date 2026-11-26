import test from "node:test";
import assert from "node:assert/strict";
import { UMAMI_BEFORE_SEND, UMAMI_BEFORE_SEND_SCRIPT, anonymiseIds } from "./umami";

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
  new Function("window", UMAMI_BEFORE_SEND_SCRIPT)(win);
  const payload = { url: "/players/2002083882", referrer: "https://fmscouting.sebastianfoder.com/players/123456", website: "x" };
  assert.deepEqual(win[UMAMI_BEFORE_SEND]("event", payload), {
    url: "/players/[id]",
    referrer: "https://fmscouting.sebastianfoder.com/players/[id]",
    website: "x",
  });
});
