/** Plans (tiers) and who may pick one. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TIERS, tierById, tierOfEngine, plansPublic, tierView } from "./plans";
import { engineFor, engineDefault, engineOf, canChoosePlan } from "./engineChoice";

const OWNER = { id: "8fdf054a-dc0d-4ed3-8a31-d77cf7ba4cf8", email: "owner@example.com" };
const USER = { id: "11111111-2222-3333-4444-555555555555", email: "student@example.com" };

function withEnv(env: Record<string, string | undefined>, f: () => void) {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    old[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    f();
  } finally {
    for (const k of Object.keys(old)) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
}

test("exactly three plans: basic = v3, standard = v5, advanced = v6 with AI images on", () => {
  assert.deepEqual(TIERS.map((t) => [t.id, t.engine]), [["basic", "v3"], ["standard", "v5"], ["advanced", "v6"]]);
  assert.equal(tierById("advanced")?.defaultImages, "ai");
  assert.equal(tierById("advanced")?.planFirst, true);
  assert.equal(tierOfEngine("v5")?.id, "standard");
  assert.equal(tierOfEngine("v4"), undefined);
});

test("every plan shows 4–6 example slides that exist in public/", () => {
  for (const t of TIERS) {
    assert.ok(t.preview.length >= 4 && t.preview.length <= 6, t.id);
    for (const s of t.preview) {
      assert.ok(fs.existsSync(path.join(process.cwd(), "public", s.src)), s.src);
      assert.ok(s.alt.length > 10);
    }
  }
});

test("prices are placeholders until set in env", () => {
  withEnv({ PLAN_PRICE_STANDARD: undefined }, () => assert.equal(tierView(tierById("standard")!).price, null));
  withEnv({ PLAN_PRICE_STANDARD: "Rs 29 a deck" }, () => assert.equal(tierView(tierById("standard")!).price, "Rs 29 a deck"));
});

test("until release only the owner may pick a plan; everyone else gets ENGINE_DEFAULT (v3)", () => {
  withEnv({ OWNER_USER_IDS: OWNER.id, OWNER_EMAILS: undefined, PLANS_PUBLIC: undefined, ENGINE_DEFAULT: undefined }, () => {
    assert.equal(plansPublic(), false);
    assert.equal(engineDefault(), "v3");
    assert.equal(engineFor(OWNER, "v6"), "v6");
    assert.equal(engineFor(OWNER, "standard"), "v5");
    assert.equal(engineFor(OWNER, "v4"), "v3"); // the retired engine falls back to the default
    assert.equal(engineFor(USER, "v6"), "v3");
    assert.equal(engineFor(null, "advanced"), "v3");
    assert.equal(canChoosePlan(USER), false);
  });
});

test("PLANS_PUBLIC=true lets every visitor pick a plan", () => {
  withEnv({ OWNER_USER_IDS: OWNER.id, PLANS_PUBLIC: "true", ENGINE_DEFAULT: undefined }, () => {
    assert.equal(canChoosePlan(USER), true);
    assert.equal(canChoosePlan(null), true);
    assert.equal(engineFor(USER, "advanced"), "v6");
    assert.equal(engineFor(null, "v5"), "v5");
    assert.equal(engineFor(USER, undefined), "v3");
  });
});

test("ENGINE_DEFAULT accepts an engine or a plan name; v4 is no longer an engine", () => {
  withEnv({ ENGINE_DEFAULT: "standard" }, () => assert.equal(engineDefault(), "v5"));
  withEnv({ ENGINE_DEFAULT: "v4" }, () => assert.equal(engineDefault(), "v3"));
  assert.equal(engineOf("V6"), "v6");
  assert.equal(engineOf("basic"), "v3");
});
