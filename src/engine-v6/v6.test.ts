/** Engine v6 — generated style, contrast, plan cards, v6 layouts (no AI, no browser). */
import test from "node:test";
import assert from "node:assert/strict";
import { buildStyle, ensureContrast, seedStyles, seedTokens, minContrast, heroOf, fontPairV6, rotateHue, type StyleTokens } from "./style";
import { contrast } from "../engine-v3/agents/artDirector";
import { THEMES, themeDesignSystem } from "../engine-v5/themes";
import { TEMPLATES, catalogText, templateById } from "../engine-v5/templates";
import { renderSlide } from "../engine-v5/render";
import { problemsOf, normalizeOne, V6_STORY, type PlannedSlide } from "../engine-v5/planner";
import { flowToMermaid } from "./flow";
import { cardsOf, pointsOf, applyCards, type PlanData } from "./plan";
import { previewSlideOf } from "./preview";

const tok = (over: Partial<StyleTokens> = {}): StyleTokens => ({ id: "t1", name: "Test", why: "", mood: "", dark: false, palette: { bg: "#f6f1e7", surface: "#fffdf8", ink: "#231a20", muted: "#5e5458", primary: "#5b2a4e", accent: "#2f8f62", accent2: "#c9a227" }, font: "warm-serif", hindiFont: "hindi-serif", card: "outline", motif: "lines", hero: "paper", radius: 8, shadow: "none", origin: "ai", ...over });

test("ensureContrast moves a colour until it reaches the ratio on every background", () => {
  const c = ensureContrast("#ffd34d", ["#ffffff", "#f6f6f6"], 4.5);
  assert.ok(minContrast(c, ["#ffffff", "#f6f6f6"]) >= 4.5, c);
  assert.equal(ensureContrast("#111111", ["#ffffff"], 4.5), "#111111");
});

test("every generated style passes WCAG on every text/background pair the templates use", () => {
  const bad: StyleTokens[] = [
    tok(),
    // a model's worst ideas: yellow text on white, grey on grey, same primary and accent, light ink on a light hero
    tok({ palette: { bg: "#ffffff", surface: "#ffffff", ink: "#cccccc", muted: "#dddddd", primary: "#ffe066", accent: "#ffe066", accent2: "#fff3b0" }, hero: "deep" }),
    tok({ dark: true, palette: { bg: "#101010", surface: "#141414", ink: "#333333", muted: "#444444", primary: "#222266", accent: "#331111", accent2: "#112211" }, hero: "dark", card: "glass" }),
    tok({ palette: { bg: "#7a7a7a", surface: "#808080", ink: "#8a8a8a", muted: "#909090", primary: "#777777", accent: "#888888", accent2: "#999999" }, hero: "duotone" }),
    tok({ hero: "wash", palette: { bg: "#fdf6e3", surface: "#fffaf0", ink: "#1b1b1b", muted: "#6b6b6b", primary: "#e9a23b", accent: "#2aa198", accent2: "#d33682" } }),
    ...THEMES.map(seedTokens),
  ];
  for (const t of bad) {
    const b = buildStyle(t);
    for (const c of b.checks) assert.ok(c.ratio >= c.min, `${t.name}: ${c.pair} = ${c.ratio} < ${c.min}`);
    // chart colours are told apart
    assert.notEqual(b.theme.palette.primary, b.theme.palette.accent);
    assert.match(b.css, /--accent-ink:#[0-9a-f]{6}/);
  }
});

test("the deck CSS uses the proven text colours (eyebrow, accent text, hero)", () => {
  const b = buildStyle(tok());
  const d = themeDesignSystem(b.theme, "English", { font: fontPairV6(b.tokens, "English"), css: b.css });
  assert.ok(d.css.includes("--hero-eyebrow"));
  assert.ok(!/\.v5-num\{[^}]*color:var\(--accent\)/.test(d.css), "accent text must read --accent-ink");
  assert.equal(d.font.heading, "Fraunces");
  assert.equal(fontPairV6(b.tokens, "Hindi").script, "devanagari");
  // v5 decks are unchanged: no v6 variables in their CSS
  assert.ok(!themeDesignSystem(THEMES[0], "English").css.includes("--accent-ink"));
});

test("hero backgrounds list the colours text sits on", () => {
  for (const h of ["deep", "wash", "dark", "paper", "duotone"] as const) {
    const r = heroOf(tok({ hero: h }));
    assert.ok(r.stops.length >= 2 && r.css.length > 10);
  }
  assert.match(rotateHue("#5b2a4e", 150), /^#[0-9a-f]{6}$/);
});

test("seeds: three different fallback styles for a topic", () => {
  const s = seedStyles("Photosynthesis", "biology");
  assert.equal(s.length, 3);
  assert.equal(new Set(s.map((x) => x.id)).size, 3);
  assert.equal(s[0].id, "seed-forest");
});

test("v6 layouts stay out of the v5 catalog and render", () => {
  assert.ok(!catalogText("v5").includes("chart-trend"));
  assert.ok(catalogText("v6").includes("chart-trend") && catalogText("v6").includes("flowchart") && catalogText("v6").includes("donut"));
  const theme = buildStyle(tok()).theme;
  const ctx: any = { theme, deckTitle: "Inequality", n: 4, total: 8, fields: [], logo: false, language: "English" };
  const trend = renderSlide({ template: "chart-trend", title: "Top 1% share rose", chart: { kind: "line", unit: "%", items: [{ label: "1980", value: 23 }, { label: "2000", value: 30 }, { label: "2020", value: 35 }] }, takeaway: "x", stat: { value: "+12", label: "pts" } }, ctx);
  assert.ok(trend.includes('data-kind="line"') && trend.includes("v5-trend-insight"));
  assert.ok(renderSlide({ template: "donut", title: "Split", chart: { kind: "donut", items: [{ label: "a", value: 60 }, { label: "b", value: 40 }] }, takeaway: "t" }, ctx).includes('data-kind="donut"'));
  // a flowchart without its drawn SVG still shows its boxes (never an empty slide)
  const fc = renderSlide({ template: "flowchart", title: "Chain", flow: { nodes: [{ id: "a", label: "Gap widens" }, { id: "b", label: "Demand falls" }, { id: "c", label: "Growth slows" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }] } }, ctx);
  assert.ok(fc.includes("Gap widens") && fc.includes("v3-diagram"));
  // closing recaps three takeaways
  const cl = renderSlide({ template: "closing", title: "Thank you", lede: "Answer", items: [{ title: "One" }, { title: "Two" }, { title: "Three" }] }, ctx);
  assert.equal((cl.match(/v5-recap-row/g) || []).length, 3);
});

test("flowchart slots become safe Mermaid text (no model-written code)", () => {
  const m = flowToMermaid({ nodes: [{ id: "a", label: 'Gap "widens" <script>', type: "step" }, { id: "b", label: "Policy?", type: "decision" }, { id: "c", label: "Growth", type: "end" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c", label: "yes|no" }] });
  assert.ok(m.startsWith("flowchart LR"));
  assert.ok(!/<script>|"widens"/.test(m));
  assert.ok(m.includes('na{') === false && m.includes('nb{"Policy?"}'));
  assert.equal(problemsOf({ n: 3, role: "", template: "flowchart", title: "T", flow: { nodes: [{ id: "a", label: "x" }], edges: [] } } as PlannedSlide).length > 0, true);
});

test("planner story rules ask for action titles and an argument", () => {
  assert.match(V6_STORY, /ACTION TITLES/);
  assert.match(V6_STORY, /QUESTION[\s\S]*EVIDENCE[\s\S]*ANSWER/);
  const one = normalizeOne({ n: 3, template: "flowchart", title: "Inequality slows growth", beat: "mechanism", flow: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "zz" }] } }, { title: "x", slideCount: 8, language: "English", requiredSections: [] } as any, { facts: [], sources: [], keyTerms: [] } as any);
  assert.ok(one);
  assert.equal(one!.beat, "mechanism");
  assert.equal(one!.flow!.edges.length, 2, "edges to unknown boxes are dropped");
});

const data = (): PlanData => ({
  brief: { title: "Inequality", slideCount: 6, language: "English", requiredSections: [] } as any,
  research: { facts: [{ id: "F1", text: "Top 1% hold 35%", sources: ["S1"] }], sources: [{ id: "S1", kind: "openalex", title: "Paper", url: "", authors: ["Thomas Piketty"], year: 2014, text: "", accessed: "" }], keyTerms: [] } as any,
  slides: [
    { id: "s1", n: 1, role: "title", template: "title-split", title: "Inequality", lede: "Sub" },
    { id: "s2", n: 2, role: "stat", template: "big-stat", title: "The top 1% own a third", stat: { value: "35%", label: "wealth share" }, factIds: ["F1"] },
    { id: "s3", n: 3, role: "cards", template: "cards-3", title: "Three causes", items: [{ title: "Tech", text: "a" }, { title: "Tax", text: "b" }, { title: "Inheritance", text: "c" }] },
    { id: "s4", n: 4, role: "summary", template: "takeaways", title: "So what", items: [{ title: "x" }, { title: "y" }, { title: "z" }] },
    { id: "s5", n: 5, role: "references", template: "references", title: "References" },
    { id: "s6", n: 6, role: "closing", template: "closing", title: "Thank you" },
  ] as any,
  styles: [],
  requests: 1,
  repaired: [],
});

test("plan cards show points and a source chip; fixed slides are marked", () => {
  const c = cardsOf(data());
  assert.equal(c.length, 6);
  assert.equal(c[0].fixed, "title");
  assert.equal(c[4].fixed, "references");
  assert.deepEqual(c[1].sources, ["Piketty 2014"]);
  assert.ok(c[1].points[0].includes("35%"));
  assert.ok(pointsOf(data().slides[2] as any).some((p) => p.includes("Tech")));
  assert.equal(previewSlideOf(data().slides as any)?.n, 2);
});

test("approving an untouched plan keeps every slide without any AI call; reorder and delete just renumber", async () => {
  const d = data();
  const cards = cardsOf(d);
  const same = await applyCards(d, cards);
  assert.equal(same.rewritten, 0);
  assert.deepEqual(same.slides.map((s) => s.template), d.slides.map((s) => s.template));
  // move "So what" up, delete "Three causes"
  const edited = [cards[0], cards[3], cards[1], cards[4], cards[5]];
  const r = await applyCards(d, edited);
  assert.equal(r.rewritten, 0);
  assert.deepEqual(r.slides.map((s) => [s.n, s.template]), [[1, "title-split"], [2, "takeaways"], [3, "big-stat"], [4, "references"], [5, "closing"]]);
});

test("every template id is unique and v6 templates carry the v6 flag", () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const id of ["chart-trend", "donut", "flowchart"]) assert.equal(templateById(id)?.v6, true);
});

test("contrast helper sanity", () => {
  assert.ok(contrast("#000000", "#ffffff") > 20);
});


// ── v6 drawings, numbers and story repairs ─────────────────────────────────
import { chartSvg, donutSvg, niceScale, prepareChart, heroStatOf } from "./charts";
import { flowSvg } from "./flow";
import { measured, titleClamp, closingRecap } from "../engine-v5/planner";

test("charts: nice axis steps, every label on its own point, units printed, bars start at zero", () => {
  const sc = niceScale(23.5, 30.4);
  assert.ok(sc.min <= 23.5 && sc.max >= 30.4 && [0.5, 1, 2, 2.5, 5].includes(sc.step), JSON.stringify(sc));
  const svg = chartSvg({ kind: "line", unit: "%", items: [{ label: "1989", value: 23.5 }, { label: "2000", value: 27.5 }, { label: "2010", value: 28.8 }, { label: "2019", value: 30.4 }] });
  for (const l of ["1989", "2000", "2010", "2019", "23.5%", "30.4%"]) assert.ok(svg.includes(`>${l}<`), l);
  // x of each year label equals the x of its point
  const xs = [...svg.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => m[1]);
  for (const x of xs) assert.ok(svg.includes(`<text x="${x}"`), "label under point " + x);
  const bars = chartSvg({ kind: "bars", unit: "bn", items: [{ label: "A", value: 3 }, { label: "B", value: 5 }] });
  assert.ok(bars.includes(">0 bn<") || bars.includes(">0<"), "bars axis starts at zero");
  assert.ok(bars.includes(">5 bn<"), "word units get a space");
  assert.equal(chartSvg({ kind: "line", items: [{ label: "x", value: 1 }] }), "", "one point is not a chart");
  const d = donutSvg({ unit: "%", items: [{ label: "Top 10%", value: 67 }, { label: "Middle 40%", value: 30 }, { label: "Bottom 50%", value: 3 }] });
  assert.ok(d.includes(">67%<") && d.includes(">Bottom 50%<"));
  const c = prepareChart({ template: "chart-trend", title: "t", chart: { kind: "line", unit: "%", items: [{ label: "a", value: "1" as any }, { label: "b", value: 2 }] } } as any);
  assert.ok(c.svg && c.svg.startsWith("<svg"));
});

test("flowchart: own layout, every box drawn with its words, decisions marked, unknown edges dropped", () => {
  const svg = flowSvg({ nodes: [{ id: "a", label: "High inequality", type: "step" }, { id: "b", label: "Policy response?", type: "decision" }, { id: "c", label: "Redistribution steadies growth", type: "step" }, { id: "d", label: "Less spending by poor households", type: "end" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c", label: "yes" }, { from: "b", to: "d", label: "no" }, { from: "c", to: "zz" }] });
  for (const w of ["High", "inequality", "Policy", "yes", "no"]) assert.ok(svg.includes(w), w);
  assert.ok(!svg.includes("…"), "labels fit without cutting a word");
  assert.equal((svg.match(/marker-end/g) || []).length, 3);
  assert.ok(svg.includes("stroke-dasharray"), "decision box is marked");
});

test("numbers: a stat is a measured quantity; the title slide's number comes from the deck", () => {
  for (const v of ["32.5%", "$18.3 tn", "3,000", "0.41", "+9.5 pts"]) assert.ok(measured(v), v);
  for (const v of ["2003", "1", "0", "much more", ""]) assert.ok(!measured(v), v);
  assert.ok(problemsOf({ n: 2, role: "", template: "big-stat", title: "T", stat: { value: "2003", label: "year" } } as PlannedSlide).length > 0);
  assert.ok(problemsOf({ n: 2, role: "", template: "stats-row", title: "T", items: [{ value: "1969" }, { value: "2" }, { value: "1" }] } as PlannedSlide).length > 0);
  assert.deepEqual(heroStatOf([{ template: "cards-3" }, { template: "stats-row", items: [{ value: "32.5%", label: "Top 1% share" }] }]), { value: "32.5%", label: "Top 1% share" });
});

test("action titles stay whole sentences; the closing slide answers and recaps", () => {
  const long = "The simulation hypothesis says our experienced reality may be a computer-generated world";
  assert.equal(titleClamp(long), long, "kept whole");
  assert.ok(!titleClamp("Inequality " + "x".repeat(40) + ", " + "y ".repeat(70)).endsWith("…"));
  const slides = [
    { n: 1, template: "title-hero", title: "Deck", role: "" },
    { n: 2, template: "big-stat", title: "Wealth is far more unequal than income.", beat: "question", role: "" },
    { n: 3, template: "chart-trend", title: "US wealth concentration rose sharply after 1989.", beat: "evidence", role: "" },
    { n: 4, template: "flowchart", title: "Inequality slows growth through weaker demand and education.", beat: "mechanism", role: "" },
    { n: 5, template: "takeaways", title: "Distribution matters as much as growth.", beat: "answer", role: "" },
    { n: 6, template: "references", title: "References", role: "" },
    { n: 7, template: "closing", title: "Thank you", lede: "Questions and discussion", role: "" },
  ] as PlannedSlide[];
  const rep: string[] = [];
  closingRecap(slides, rep);
  const c = slides[6];
  assert.equal(c.items!.length, 3);
  assert.equal(c.lede, "Distribution matters as much as growth.");
  assert.ok(c.items!.every((i) => (i.title || "").length <= 88 && !(i.title || "").endsWith(".")));
});

test("v6: a flat or ungrounded chart is a problem; hub centre words are whole", async () => {
  const { coreLabel } = await import("../engine-v5/templates");
  const flat: any = { n: 5, template: "chart-trend", title: "t", chart: { kind: "line", unit: "", items: [{ label: "Early", value: 0 }, { label: "Middle", value: 0 }, { label: "Late", value: 0 }] } };
  assert.ok(problemsOf(flat).length > 0);
  const ok: any = { ...flat, chart: { ...flat.chart, items: [{ label: "1990", value: 0.31 }, { label: "2000", value: 0.36 }, { label: "2010", value: 0.41 }] } };
  assert.equal(problemsOf(ok).length, 0);
  assert.ok(problemsOf({ ...ok, ungrounded: true } as any).length > 0);
  assert.equal(coreLabel("Fair distribution builds security and opportunity"), "Fair distribution");
  assert.ok(!coreLabel("A very long title about the economics of everything").includes("…"));
});
