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
  for (const t of TEMPLATES) if (!t.v6) assert.ok(c.includes(t.id));
  const c6 = catalogText("v6");
  for (const t of TEMPLATES) assert.ok(c6.includes(t.id));
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


// ── natural-language slots, citations, sparse slides (live deck 2026-11-02: slide 2 empty sidebar, slide 7 raw links) ──
import { naturalText, hasRawRef } from "./text";
import { buildReferences, citeSource, citeAuthors, inferFactIds, sourceLink } from "./cite";
import { sparseProblems, fittingTemplate } from "./sparse";
import { normalizeOne, factsBlock } from "./planner";

test("slot text is natural language: no URLs, wiki paths, DOIs, [n] markers, fact ids or source tails", () => {
  const raw = [
    "The Gini coefficient measures inequality (https://en.wikipedia.org/wiki/Gini_coefficient).",
    "According to Wikipedia, the top 1% held 32.5% of US wealth [12].",
    "Piketty proposes a wealth tax. Source: en.wikipedia.org/wiki/Thomas_Piketty",
    "Growth falls as rent-seeking rises (F19, S4)",
    "Growth slows when inequality is high, see doi.org/10.1086/654291 for details",
    "Read more: [Lorenz curve](https://en.wikipedia.org/wiki/Lorenz_curve) explains it",
  ];
  for (const t of raw) {
    const n = naturalText(t);
    assert.ok(!hasRawRef(n), `${t} → ${n}`);
    assert.ok(!/wikipedia|https?:|www\.|doi/i.test(n), n);
    assert.ok(n.length > 10, n);
  }
  assert.equal(naturalText("According to Wikipedia, the top 1% held 32.5% of US wealth [12]."), "The top 1% held 32.5% of US wealth.");
  assert.equal(naturalText("Amazon.com grew fast in 2020"), "Amazon.com grew fast in 2020");
  assert.equal(naturalText("भारत में असमानता बढ़ी है [3]"), "भारत में असमानता बढ़ी है");
});

test("the planner's slots are cleaned on the way in", () => {
  const r: any = { facts: [{ id: "F1", text: "x", sources: ["S1"] }], sources: [{ id: "S1", kind: "wikipedia" }], keyTerms: [] };
  const s = normalizeOne({ n: 3, template: "cards-3", title: "Wealth tax (https://en.wikipedia.org/wiki/Wealth_tax)", items: [{ icon: "coins", title: "Tax", text: "Piketty proposes a global wealth tax [F39]. Source: Wikipedia" }, { icon: "book", title: "Education", text: "Better schools, see en.wikipedia.org/wiki/Education" }, { icon: "users", title: "Rents", text: "Curb rent-seeking (S4)" }] }, brief, r)!;
  const all = JSON.stringify(s);
  assert.ok(!/wikipedia|https?:|\[F39\]|\(S4\)/i.test(all), all);
  assert.equal(s.items![0].text, "Piketty proposes a global wealth tax.");
});

test("citations are words, not links; duplicate authors are merged; links go to the notes", () => {
  const wiki: any = { id: "S1", kind: "wikipedia", title: "Economic inequality", url: "https://en.wikipedia.org/wiki/Economic_inequality", accessed: "2026-11-02T08:37:00Z", text: "" };
  const paper: any = { id: "S4", kind: "openalex", title: "Inequality and Growth", url: "https://doi.org/10.1086/654291", doi: "10.1086/654291", authors: ["Roland Bénabou", "Roland Bénabou"], year: 1996, venue: "NBER Macroeconomics Annual", accessed: "2026-11-02", text: "" };
  const a = citeSource(wiki), b = citeSource(paper);
  assert.ok(!/https?:|www\.|doi\.org/.test(a + b), a + b);
  assert.match(a, /^“Economic inequality\.” Wikipedia, The Free Encyclopedia \(accessed 2 Nov 2026\)\.$/);
  assert.equal(b, "Bénabou, R. (1996). Inequality and Growth. NBER Macroeconomics Annual.");
  assert.equal(citeAuthors(["Edward N. Wolff"]), "Wolff, E. N.");
  assert.equal(citeAuthors(["Harish Patel", "Patel H"]), "Patel, H.");
  assert.equal(citeAuthors(["A B", "C D", "E F", "G H"]), "B, A., D, C., F, E., et al.");
  assert.equal(sourceLink(paper), "https://doi.org/10.1086/654291");
  assert.match(citeSource(wiki, "Hindi"), /विकिपीडिया/);
});

test("a slide with no fact ids still credits the facts its numbers come from", () => {
  const facts: any[] = [
    { id: "F6", text: "As of Q2 2026, the top 1% of households in the United States held 32.5% of the country's wealth.", sources: ["S2"] },
    { id: "F7", text: "As of Q2 2026, the bottom 50% of US households held 2.3% of the country's wealth.", sources: ["S2"] },
    { id: "F12", text: "The Great Recession in the US from December 2007 to June 2009 caused a dip in the wealth owned by the top 1%.", sources: ["S2"] },
    { id: "F29", text: "Thomas Piketty's 2013 book Capital in the Twenty-First Century emphasizes wealth concentrations.", sources: ["S12"] },
  ];
  const ids = inferFactIds("US Wealth Is Highly Concentrated · 32.5% Top 1% wealth share · Q2 2026 share of US household wealth · 2.3% Bottom 50% wealth share", facts);
  assert.deepEqual(ids.sort(), ["F6", "F7"]);
  assert.deepEqual(inferFactIds("Photosynthesis turns light into sugar", facts), []);
});

test("facts tell the planner which come from papers", () => {
  const b = factsBlock({ facts: [{ id: "F1", text: "a", sources: ["S1"] }, { id: "F2", text: "b", sources: ["S2"] }], sources: [{ id: "S1", kind: "wikipedia" }, { id: "S2", kind: "openalex" }], keyTerms: [] } as any);
  assert.match(b, /F1 \(encyclopedia\): a/);
  assert.match(b, /F2 \(paper\): b/);
});

test("agenda without a photo fills its sidebar with the deck's question and the parts' icons; type capped", () => {
  const its = [1, 2, 3, 4].map((k) => ({ icon: "lucide:star", title: `Part ${k}`, text: "Core concepts and the central trade-off" }));
  const h = renderSlide({ template: "agenda", title: "Today's Roadmap", lede: "", items: its } as any, ctx({ deckTitle: "The Economics of Inequality: Is Wealth Distribution More Important Than Economic Growth?" }) as any);
  assert.match(h, /Is Wealth Distribution More Important Than Economic Growth\?/);
  assert.match(h, /4 parts · 8 slides/);
  assert.match(h, /data-max-s="1.25"/);
  assert.equal(bakeScales(h, 1.2, 1).match(/--s:1.2;/)?.length, 1);
  const withPhoto = renderSlide({ template: "agenda", title: "Agenda", items: its } as any, ctx({ heroPhoto: "img1" }) as any);
  assert.ok(!/4 parts/.test(withPhoto));
});

test("sparse slides are detected (empty band in a panel, content stopping high) — calm layouts are exempt", () => {
  assert.deepEqual(sparseProblems("cards-3", { fill: 0.95, holes: [], s: 1 }), []);
  assert.equal(sparseProblems("cards-3", { fill: 0.45, holes: [], s: 1.5 }).length, 1);
  assert.equal(sparseProblems("hub", { fill: 1, holes: [{ where: "v5-panel.v5-panel-primary", gap: 0.55 }], s: 1.5 }).length, 1);
  assert.deepEqual(sparseProblems("closing", { fill: 0.2, holes: [], s: 1 }), []);
  assert.deepEqual(sparseProblems("title-hero", { fill: 0.2, holes: [], s: 1 }), []);
  assert.equal(fittingTemplate("cards-4", 2), "cards-2");
  assert.equal(fittingTemplate("takeaways", 3, ["cards-3"]), "process");
  assert.equal(fittingTemplate("cards-3", 3, []), "process");
});

test("photo queries name photographable things (no maps / charts / indices)", () => {
  const r: any = { facts: [], sources: [], keyTerms: [] };
  const a = normalizeOne({ n: 4, template: "photo-split", title: "Wealth", items: [{ text: "a" }, { text: "b" }], photo_query: "World map", photo_alt: "Gini coefficient map" }, brief, r)!;
  assert.equal(a.photoQuery, undefined);
  const b = normalizeOne({ n: 4, template: "photo-split", title: "Wealth", items: [{ text: "a" }, { text: "b" }], photo_query: "Lorenz curve chart", photo_alt: "Thomas Piketty" }, brief, r)!;
  assert.equal(b.photoQuery, "Thomas Piketty");
});

test("references: papers one by one; 3+ Wikipedia articles become one entry naming every article", () => {
  const W = (id: string, title: string): any => ({ id, kind: "wikipedia", title, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, "_")}`, accessed: "2026-11-02T08:37:00Z", text: "" });
  const P: any = { id: "S4", kind: "openalex", title: "Inequality and Growth", url: "https://doi.org/10.1086/654291", doi: "10.1086/654291", authors: ["Roland Bénabou"], year: 1996, venue: "NBER Macroeconomics Annual", accessed: "2026-11-02", text: "" };
  const srcs = [W("S1", "Economic inequality"), W("S2", "Distribution of wealth"), P, W("S7", "Gini coefficient")];
  const { refs, numOf } = buildReferences(["S1", "S2", "S4", "S7"], srcs);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].text, "Wikipedia, The Free Encyclopedia — articles “Economic inequality”, “Distribution of wealth”, “Gini coefficient” (accessed 2 Nov 2026).");
  assert.equal(refs[1].text, "Bénabou, R. (1996). Inequality and Growth. NBER Macroeconomics Annual.");
  assert.equal(numOf.get("S7"), 1);
  assert.equal(numOf.get("S4"), 2);
  assert.equal(refs[0].urls.length, 3);
  assert.ok(!refs.some((r) => /https?:/.test(r.text)));
  // one or two articles stay separate entries
  assert.equal(buildReferences(["S1", "S4"], srcs).refs.length, 2);
  assert.match(buildReferences(["S1", "S4"], srcs).refs[0].text, /^“Economic inequality\.”/);
});
