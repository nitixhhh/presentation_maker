/** Engine v4 polish-pass tests: placeholder gate, photo rules, finish scripts (no network, no browser). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizePlaceholders, removeEmptyDetailRows, finalizePlaceholders, assertNoPlaceholdersInPptx, elementsOf } from "./finalize";
import { isProductShot, briefLeaks } from "./photoRules";
import { DECOR_JS, FONT_FLOOR_JS, GROW_JS, CONTENT_BOTTOM_JS, CARD_SLACK_JS } from "./finish";
import { readSkill } from "./skills";

const ONE = [{ label: "Presented by", value: "Rahul Das (Roll 23CSE041)" }];

test("placeholders: invented / empty detail rows are removed with their label", () => {
  const h = `<div class="meta"><div class="row"><span>Presented by</span><strong>{{P1}}</strong></div><div class="row"><span>Course</span><strong>{{P2}}</strong></div><div class="row"><span>Institution</span><strong>{{P3}}</strong></div><div class="row"><span>Date</span><strong>{{P4}}</strong></div></div>`;
  const out = sanitizePlaceholders(h, ONE).html;
  assert.ok(out.includes("Rahul Das (Roll 23CSE041)"));
  assert.ok(!/\{\{/.test(out));
  assert.ok(!/Course|Institution|Date/.test(out));
});

test("placeholders: grid layouts (label and value as siblings) lose the orphan label", () => {
  const h = `<div class="meta"><span>Presented by</span><strong>{{P1}}</strong><span>Roll No.</span><strong>{{P2}}</strong></div>`;
  const out = removeEmptyDetailRows(sanitizePlaceholders(h, ONE).html).html;
  assert.equal(out, `<div class="meta"><span>Presented by</span><strong>Rahul Das (Roll 23CSE041)</strong></div>`);
  const hi = `<div class="meta"><span>प्रस्तुतकर्ता</span><strong>{{P1}}</strong><span>विभाग</span><strong>{{P2}}</strong></div>`;
  assert.ok(!/विभाग/.test(removeEmptyDetailRows(sanitizePlaceholders(hi, ONE).html).html));
});

test("placeholders: every filled detail is substituted and kept", () => {
  const f = [{ label: "Presented by", value: "Priya" }, { label: "Course", value: "B.Tech CSE" }, { label: "Institute", value: "IIT X" }, { label: "Date", value: "1 Nov 2026" }];
  const h = `<div class="meta"><span>Presented by</span><strong>{{P1}}</strong><span>Course</span><strong>{{P2}}</strong><span>Institute</span><strong>{{P3}}</strong><p>Date: {{P4}}</p></div>`;
  const out = removeEmptyDetailRows(sanitizePlaceholders(h, f).html).html;
  for (const v of ["Priya", "B.Tech CSE", "IIT X", "1 Nov 2026", "Course", "Institute", "Date"]) assert.ok(out.includes(v), v);
});

test("placeholders: label rows with an empty value and stray tokens never survive; headings keep their text", () => {
  const h = `<h1>Black holes {{subtitle}}</h1><div class="who"><p><span>Presented by </span>{{P1}}</p><p class="x">Guide: N/A</p><div class="row"><span>Department</span><strong></strong></div></div>`;
  const out = removeEmptyDetailRows(sanitizePlaceholders(h, ONE).html).html;
  assert.ok(out.includes("<h1>Black holes </h1>"));
  assert.ok(!/Guide|Department|\{\{|\}\}/.test(out));
});

test("placeholders: the deck gate cleans every slide and notes", () => {
  const deck: any = { brief: { titleSlideFields: ONE }, outline: { slides: [{ n: 1, role: "title" }, { n: 2, role: "concept" }] }, slides: [{ n: 1, html: `<div><span>Course</span><b>{{P3}}</b></div><p>{{P1}}</p>`, notes: "By {{P1}} {{P2}}" }, { n: 2, html: `<p>text {{P9}}</p>` }] };
  const log = finalizePlaceholders(deck);
  assert.ok(log.length >= 1);
  assert.ok(deck.slides.every((s: any) => !/\{\{/.test(s.html) && !/\{\{/.test(s.notes || "")));
  assert.ok(deck.slides[0].html.includes("Rahul Das"));
});

test("placeholders: PPTX proof finds a token in slide XML", async () => {
  const JSZip = (await import("jszip")).default;
  const z = new JSZip();
  z.file("ppt/slides/slide1.xml", "<a:t>Course {{P2}}</a:t>");
  await assert.rejects(assertNoPlaceholdersInPptx(await z.generateAsync({ type: "nodebuffer" }), "t"));
  const ok = new JSZip();
  ok.file("ppt/slides/slide1.xml", "<a:t>Course B.Tech</a:t>");
  await assertNoPlaceholdersInPptx(await ok.generateAsync({ type: "nodebuffer" }), "t");
});

test("html element matcher handles void tags and nesting", () => {
  const els = elementsOf(`<div><img src="a"><p>a<br>b</p><span><b>x</b></span></div>`);
  assert.deepEqual(els.map((e) => e.tag).sort(), ["b", "div", "p", "span"]);
});

test("photos: product / gadget shots are rejected unless the slide is about them", () => {
  assert.equal(isProductShot("Virtual reality headset — image of an oculus rift headset", "What Is the Simulation Hypothesis?"), true);
  assert.equal(isProductShot("Plato Silanion Musei Capitolini", "Philosophical precursors"), false);
  assert.equal(isProductShot("Smartphone with apps", "How smartphones changed communication"), false);
  assert.equal(isProductShot("Great Rift Valley from space", "Plate tectonics"), false);
});

test("finish scripts are valid JavaScript", () => {
  for (const js of [DECOR_JS, CONTENT_BOTTOM_JS, CARD_SLACK_JS]) assert.doesNotThrow(() => new Function(`return ${js.replace(/\(\)\s*$/, "")}`));
  for (const js of [FONT_FLOOR_JS, GROW_JS]) assert.doesNotThrow(() => new Function(`return ${js}`));
});

test("skills no longer teach decorative numerals or extra placeholders", () => {
  const title = readSkill("layouts/title.md");
  assert.ok(!/\{\{P[2-9]\}\}/.test(title));
  assert.ok(!/class="big"/.test(title));
  assert.ok(!/class="num"/.test(readSkill("layouts/section-divider.md")));
});

test("brief notes printed on a slide are caught; the slide's own content is not", () => {
  const b = { visual: { idea: "Three stacked bands — science, ethics, daily life — each with its own implication." }, designerBrief: "Use a calm layout with generous whitespace around the bands." };
  assert.ok(briefLeaks("Implications Three stacked bands — science, ethics, daily life — each with its own implication.", b).length >= 1);
  assert.equal(briefLeaks("Science: digital physics frames the universe as information", b, "digital physics frames the universe as information").length, 0);
  assert.equal(briefLeaks("anything", undefined).length, 0);
});
