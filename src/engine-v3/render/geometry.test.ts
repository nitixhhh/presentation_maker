/**
 * Geometry detector + auto-fix on real Chromium (Playwright) with fixtures that have known problems.
 * Run with `npm test`. Skips itself when no Chromium is installed.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { MEASURE_JS, SERIALIZE_JS } from "./domScripts";
import { GEOMETRY_JS, GEOMETRY_FIX_JS } from "./geometry";

let browser: Browser | null = null;
before(async () => {
  browser = await chromium.launch({ headless: true }).catch(() => null);
});
after(async () => {
  await browser?.close();
});

const page = async (inner: string): Promise<Page> => {
  const p = await browser!.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<!DOCTYPE html><html><head><style>
    body{margin:0;font-family:Arial,sans-serif;background:#fff}
    section.slide{position:relative;width:1280px;height:720px;overflow:hidden;background:#fbf8f2}
  </style></head><body><section class="slide">${inner}</section></body></html>`);
  return p;
};
async function geometry(p: Page) {
  await p.evaluate(MEASURE_JS);
  return (await p.evaluate(GEOMETRY_JS)) as { issues: { type: string; severity: string; id?: string; detail: string }[] };
}

// the photosynthesis test deck's failures, rebuilt: overlapping diagram labels, an arrow through the subtitle,
// a label cut off by its svg box, a 12px label, and a box drawn on top of a label
const BROKEN = `
  <h1 style="position:absolute;left:80px;top:60px;margin:0;font-size:52px">Light reactions</h1>
  <p style="position:absolute;left:80px;top:140px;margin:0;font-size:26px;width:700px">Biomass and carbon fixation start here</p>
  <svg style="position:absolute;left:0;top:0" width="1280" height="720" viewBox="0 0 1280 720">
    <line x1="60" y1="152" x2="900" y2="152" stroke="#c0601a" stroke-width="4"/>
  </svg>
  <svg style="position:absolute;left:600px;top:300px" width="500" height="300" viewBox="0 0 500 300">
    <text x="40" y="80" font-size="24">Photosystem II</text>
    <text x="60" y="88" font-size="24">Water splitting</text>
    <text x="420" y="200" font-size="24">Regeneration</text>
    <text x="40" y="250" font-size="12">tiny caption text</text>
    <text x="250" y="150" font-size="22">ATP synthase</text>
    <rect x="240" y="120" width="120" height="50" fill="#1d1913"/>
  </svg>`;

const CLEAN = `
  <h1 style="position:absolute;left:80px;top:60px;margin:0;font-size:52px">Light reactions</h1>
  <p style="position:absolute;left:80px;top:140px;margin:0;font-size:26px;width:700px">Biomass and carbon fixation start here</p>
  <svg style="position:absolute;left:600px;top:300px" width="560" height="300" viewBox="0 0 560 300">
    <rect x="20" y="40" width="200" height="70" rx="12" fill="#fff" stroke="#a4610f" stroke-width="3"/>
    <text x="40" y="84" font-size="24">Photosystem II</text>
    <line x1="230" y1="75" x2="320" y2="75" stroke="#a4610f" stroke-width="3"/>
    <rect x="330" y="40" width="210" height="70" rx="12" fill="#fff" stroke="#a4610f" stroke-width="3"/>
    <text x="345" y="84" font-size="24">Photosystem I</text>
    <text x="40" y="220" font-size="22">Water splitting</text>
  </svg>`;

test("detector finds every planted problem with element + coordinates", async (t) => {
  if (!browser) return t.skip("no Chromium");
  const p = await page(BROKEN);
  const { issues } = await geometry(p);
  const types = issues.map((i) => i.type);
  assert.ok(issues.some((i) => i.type === "label-overlap" && /Photosystem II/.test(i.detail) && /Water splitting/.test(i.detail)), "overlapping labels");
  assert.ok(issues.some((i) => i.type === "line-over-text" && /Biomass/.test(i.detail)), "arrow through the subtitle");
  assert.ok(issues.some((i) => i.type === "label-clipped" && /Regeneration/.test(i.detail)), "label cut off by its svg");
  assert.ok(issues.some((i) => i.type === "small-label" && /tiny caption/.test(i.detail)), "12px label");
  assert.ok(issues.some((i) => i.type === "text-covered" && /ATP synthase/.test(i.detail)), "box drawn over a label");
  for (const i of issues) assert.match(i.detail, /x=-?\d+, y=-?\d+, \d+×\d+px/, `coordinates in: ${i.detail}`);
  assert.ok(!types.includes("line-over-text") || issues.filter((i) => i.type === "line-over-text").length === 1, "only the subtitle is crossed");
  await p.close();
});

test("a clean slide has zero geometry problems", async (t) => {
  if (!browser) return t.skip("no Chromium");
  const p = await page(CLEAN);
  const { issues } = await geometry(p);
  assert.deepEqual(issues.map((i) => `${i.type}: ${i.detail}`), []);
  await p.close();
});

test("deterministic auto-fix clears overlaps, lines over text, cut-off and covered labels; re-measure passes", async (t) => {
  if (!browser) return t.skip("no Chromium");
  const p = await page(BROKEN);
  let { issues } = await geometry(p);
  for (let pass = 0; pass < 4; pass++) {
    const todo = issues.filter((i) => i.id && i.severity === "high" && i.type !== "small-label").map((i) => ({ type: i.type, id: i.id }));
    if (!todo.length) break;
    await p.evaluate(`(${GEOMETRY_FIX_JS})(${JSON.stringify(todo)})`);
    ({ issues } = await geometry(p));
  }
  const left = issues.filter((i) => i.severity === "high" && i.type !== "small-label");
  assert.deepEqual(left.map((i) => `${i.type}: ${i.detail}`), []);
  // the fixed slide serializes without the engine's measuring attributes
  const html: string = await p.evaluate(SERIALIZE_JS);
  assert.ok(!/data-v3-(text|svgt|inl)/.test(html));
  assert.ok(/paint-order/.test(html) || /background-color/.test(html), "backdrop/halo kept in the saved HTML");
  await p.close();
});
