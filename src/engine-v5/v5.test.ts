/** Engine v5 — template engine tests (no AI, no browser). */
import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, templateById, catalogText } from "./templates";
import { THEMES, pickTheme, themeDesignSystem } from "./themes";
import { renderSlide } from "./render";
import { normalizePlan, enforceVariety, clamp, problemsOf, resolveIcons, sortChronologically, stripIds, type PlannedSlide } from "./planner";
import { bakeScales } from "./fit";

const ctx = (over: any = {}) => ({ theme: THEMES[0], deckTitle: "Black Holes", n: 2, total: 8, fields: [{ label: "Presented by", value: "Rahul Das" }], logo: false, language: "English", ...over });
const brief: any = { title: "Black Holes", slideCount: 8, language: "English", requiredSections: [], referenceStyle: "APA" };
const research: any = { facts: [{ id: "F1", text: "x", sources: ["S1"] }], sources: [{ id: "S1", kind: "wikipedia" }], keyTerms: [] };

test("every template renders with empty and with full content, escaping text", () => {
  const full: any = { title: "A <b>bold</b> & title", lede: "Lede", items: [1, 2, 3, 4].map((k) => ({ icon: "lucide:star", title: `T${k}`, text: `Text ${k}`, value: `${k}0%`, label: `L${k}` })), stat: { value: "42%", label: "label", text: "t" }, left: { title: "A", points: ["a1", "a2"] }, right: { title: "B", points: ["b1", "b2"] }, chart: { kind: "bars", items: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }, table: { columns: ["x", "y"], rows: [["1", "2"], ["3", "4"]] }, quote: { text: "q", author: "Someone" }, takeaway: "bottom line", term: "Term", center: "Core", photo: "img1" };
  for (const t of TEMPLATES) {
    const a = renderSlide({ template: t.id, title: "x" } as any, ctx() as any);
    const b = renderSlide({ ...full, template: t.id } as any, ctx({ references: [{ n: 1, text: "Ref" }] }) as any);
    for (const h of [a, b]) {
      assert.match(h, /class="v5 /, t.id);
      assert.ok(!/<b>bold<\/b>/.test(h), `${t.id} must escape text`);
      assert.ok(!/undefined|NaN|\[object Object\]/.test(h.replace(/<style[\s\S]*?<\/style>/g, "")), `${t.id} leaks undefined/NaN: ${h.slice(0, 200)}`);
    }
  }
});

test("photo templates without a photo fall back to a designed no-photo layout", () => {
  const h = renderSlide({ template: "photo-split", title: "x", items: [{ text: "a" }, { text: "b" }] } as any, ctx() as any);
  assert.ok(!/asset:"/.test(h) && !/src="asset:"/.test(h));
  assert.match(h, /tpl-text-focus/);
});

test("catalog lists every template for the planner", () => {
  const c = catalogText();
  for (const t of TEMPLATES) assert.ok(c.includes(t.id));
});

test("theme pick: style hint, subject keywords, design system carries v5 css", () => {
  assert.equal(pickTheme({ topic: "x", styleHint: "dark and modern" }).id, "aurora");
  assert.equal(pickTheme({ topic: "Photosynthesis in plants" }).id, "forest");
  const d = themeDesignSystem(THEMES[1], "Hindi");
  assert.equal(d.font.script, "devanagari");
  assert.match(d.css, /\.slide \.v5\{/);
});

test("planner normalisation enforces count, title, references and closing", () => {
  const raw = [{ n: 1, template: "cards-3", title: "Hello" }, { n: 2, template: "nope", title: "Two", items: [{ title: "a", text: "b" }, { title: "c", text: "d" }, { title: "e", text: "f" }] }];
  const s = normalizePlan(raw, brief, research, []);
  assert.equal(s.length, 8);
  assert.match(s[0].template, /^title-/);
  assert.equal(s[6].template, "references");
  assert.equal(s[7].template, "closing");
  assert.equal(s[1].template, "cards-3");
});

test("variety: neighbours never share a content template", () => {
  const mk = (n: number, t: string): PlannedSlide => ({ n, template: t, role: "cards", title: "t", items: [1, 2, 3].map((k) => ({ title: `x${k}`, text: "y", icon: "star" })) });
  const s = [mk(1, "title-split"), mk(2, "cards-3"), mk(3, "cards-3"), mk(4, "cards-3")];
  enforceVariety(s, []);
  assert.notEqual(s[1].template, s[2].template);
  assert.notEqual(s[2].template, s[3].template);
});

test("clamp cuts at a sentence or word, never mid-word", () => {
  assert.equal(clamp("Short.", 20), "Short.");
  const c = clamp("The first sentence is here. The second one is much longer than the limit allows.", 40);
  assert.equal(c, "The first sentence is here.");
  assert.ok(!/\w…$/.test(clamp("alpha beta gamma delta epsilon zeta eta theta", 20)) || /\s/.test(clamp("alpha beta gamma delta epsilon zeta eta theta", 20)));
});

test("slot problems are detected", () => {
  assert.deepEqual(problemsOf({ n: 3, template: "timeline", role: "x", title: "t", items: [{ title: "a" }, { title: "b" }, { title: "c" }] } as any), ["timeline dates missing"]);
  assert.equal(problemsOf({ n: 3, template: "chart", role: "x", title: "t" } as any)[0], "chart data missing");
});

test("icons resolve to real, distinct library ids", () => {
  const s: PlannedSlide = { n: 2, template: "cards-3", role: "cards", title: "t", items: [{ icon: "rocket", title: "a" }, { icon: "rocket", title: "b" }, { icon: "zzqqxx", title: "money" }] };
  resolveIcons(s);
  const ids = s.items!.map((i) => i.icon);
  assert.ok(ids.every((x) => /^[a-z]+:[\w-]+$/.test(String(x))), JSON.stringify(ids));
  assert.equal(new Set(ids).size, 3);
});

test("bakeScales writes the fitted scales into the root", () => {
  const h = renderSlide({ template: "cards-3", title: "x", items: [{ title: "a" }, { title: "b" }, { title: "c" }] } as any, ctx() as any);
  assert.match(bakeScales(h, 1.13, 0.9), /style="--s:1.13;--ts:0.9"/);
  assert.ok(templateById("cards-3"));
});

test("timelines are put in date order", () => {
  const s: any = { n: 3, template: "timeline", role: "timeline", title: "t", items: [{ label: "1981", title: "b" }, { label: "Ancient", title: "a" }, { label: "1969", title: "c" }] };
  assert.equal(sortChronologically(s), true);
  assert.deepEqual(s.items.map((i: any) => i.label), ["Ancient", "1969", "1981"]);
});

test("a short plan keeps title/refs/closing in place and marks the gaps for a separate write", () => {
  const raw = [{ n: 1, template: "title-split", title: "T" }, { n: 2, template: "cards-3", title: "A", items: [{ title: "a" }, { title: "b" }, { title: "c" }] }, { n: 3, template: "references", title: "R" }, { n: 4, template: "closing", title: "Bye" }];
  const s = normalizePlan(raw, { ...brief, slideCount: 6 }, research, []);
  assert.deepEqual(s.map((x) => x.template), ["title-split", "cards-3", "", "", "references", "closing"]);
  assert.equal(s[5].title, "Bye");
  assert.equal(s[4].title, "References");
  assert.deepEqual(problemsOf(s[2]), ["missing from the plan"]);
});

test("fact ids never reach slide text", () => {
  assert.equal(stripIds("Light splits water (F3, F36)."), "Light splits water.");
  assert.equal(stripIds("ATP is made [F12] in the thylakoid"), "ATP is made in the thylakoid");
  assert.equal(stripIds("Calvin cycle fixes CO2 F25."), "Calvin cycle fixes CO2.");
});
