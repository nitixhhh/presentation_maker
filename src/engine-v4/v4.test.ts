/** Engine v4 unit tests (no network, no browser). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readSkill, resolveSkill, layoutIds, listSkills } from "./skills";
import { expandIcons, collapseIcons, iconsInHtml } from "./iconRender";
import { makeDiagram } from "./diagrams";
import { cleanAgentHtml } from "./designerAgent";
import { outlineFromBrief } from "./planner";
import { engineFor, isOwner } from "../server/engineChoice";

test("skills: index, layouts and fuzzy names resolve", () => {
  assert.ok(listSkills().includes("INDEX.md"));
  assert.ok(layoutIds().includes("timeline") && layoutIds().includes("hub-and-spoke"));
  assert.equal(resolveSkill("skills/layouts/timeline.md"), "layouts/timeline.md");
  assert.equal(resolveSkill("Workflow"), "workflow.md");
  assert.equal(resolveSkill("timeline"), "layouts/timeline.md");
  assert.match(readSkill("nope-nothing"), /^Error: no skill/);
  assert.match(readSkill("INDEX.md"), /read this first/i);
});

test("icons: placeholders expand to inline SVG and collapse back", () => {
  const html = `<div><i class="ic" data-icon="lucide:cpu" data-size="56"></i><span data-icon="rocket"></span><i data-icon="zzqqxx-nothing"></i><i data-icon="planet"/></div>`;
  const e = expandIcons(html);
  assert.ok(e.used.includes("lucide:cpu"));
  assert.ok(e.used.some((u) => u.endsWith(":rocket")));
  assert.equal((e.html.match(/<svg/g) || []).length, 3);
  assert.match(e.html, /--ic-size:56px/);
  assert.equal(e.missing.length, 1);
  const c = collapseIcons(e.html);
  assert.ok(!/<svg/.test(c));
  assert.match(c, /<i class="ic" data-icon="lucide:cpu" data-size="56"><\/i>/);
  assert.ok(iconsInHtml(html).includes("lucide:cpu"));
  // idempotent
  assert.equal(expandIcons(e.html).html.match(/<svg/g)?.length, 3);
});

test("make_diagram: engine kinds, icons in nodes, warnings, mermaid needs code", async () => {
  const r = await makeDiagram({ kind: "hub", box: { left: 600, top: 160, width: 600, height: 420 }, items: [{ title: "Black hole", icon: "orbit" }, { title: "Event horizon", desc: "no return" }, "Singularity"] });
  assert.match(r.markup, /class="v3-diagram" data-kind="hub"/);
  assert.match(r.markup, /data-icon="lucide:orbit"/);
  assert.equal(r.icons.length, 1);
  const t = await makeDiagram({ kind: "tree", box: { left: 100, top: 0, width: 1400, height: 400 }, items: [{ title: "A" }, { title: "B", parent: "A" }] });
  assert.match(t.markup, /data-parent="A"/);
  assert.ok(t.warnings.some((w) => /past the 1280/.test(w)));
  const c = await makeDiagram({ kind: "chart", chart: "donut", box: { left: 80, top: 160, width: 600, height: 400 }, items: [{ title: "x", value: 40 }, { title: "y", value: 60 }] });
  assert.match(c.markup, /data-kind="donut"/);
  const s = await makeDiagram({ kind: "chart", chart: "stacked", series: ["A", "B"], box: { left: 80, top: 160, width: 600, height: 400 }, items: [{ title: "2020", values: [1, 2] }] });
  assert.match(s.markup, /data-series="A\|B"/);
  assert.match(s.markup, /data-values="1,2"/);
  const m = await makeDiagram({ kind: "mermaid", box: { left: 80, top: 160, width: 600, height: 400 } });
  assert.equal(m.markup, "");
  assert.match(m.warnings[0], /code/);
  const x = await makeDiagram({ kind: "matrix", axes: { x: "Effort", y: "Impact" }, box: { left: 80, top: 160, width: 600, height: 400 }, items: ["a", "b", "c", "d"] });
  assert.match(x.markup, /data-x="Effort" data-y="Impact"/);
});

test("agent HTML is cleaned: fences, <slide> wrapper, full documents, scripts", () => {
  const h = cleanAgentHtml("```html\n<slide><style>.slide .a{color:red}</style><div class=\"a\"><p>Hi</p></div><script>x()</script></slide>\n```");
  assert.ok(!/script|```|<slide>/.test(h));
  assert.match(h, /<style>/);
  const d = cleanAgentHtml(`<!DOCTYPE html><html><head><style>.slide p{color:red}</style></head><body><section class="slide"><p>x</p></section></body></html>`);
  assert.match(d, /<style>\.slide p\{color:red\}<\/style>/);
  assert.match(d, /<p>x<\/p>/);
  assert.ok(!/section/.test(d));
});

test("planner brief → v3 outline slide", () => {
  const o = outlineFromBrief({ n: 2, role: "concept", layout: "bullets-with-icons", title: "T", keyMessage: "K", points: [{ text: "p", factIds: ["F1"] }], visual: { kind: "icons", icons: ["cpu"] }, designerBrief: "" });
  assert.equal(o.visual.kind, "none");
  const p = outlineFromBrief({ n: 3, role: "process", layout: "process-steps", title: "T", keyMessage: "", points: [], visual: { kind: "diagram", diagram: "flow", idea: "3 steps" }, designerBrief: "" });
  assert.equal(p.visual.kind, "diagram");
  assert.match(p.visual.idea || "", /flow diagram: 3 steps/);
});

test("engine choice: v3 default, only the owner may pick", () => {
  const old = { ...process.env };
  process.env.OWNER_EMAILS = "Owner@Example.com, second@x.io";
  delete process.env.ENGINE_DEFAULT;
  assert.equal(isOwner({ email: "owner@example.com" }), true);
  assert.equal(engineFor({ email: "owner@example.com" }, "v4"), "v4");
  assert.equal(engineFor({ email: "someone@else.com" }, "v4"), "v3");
  assert.equal(engineFor(null, "v4"), "v3");
  process.env.ENGINE_DEFAULT = "v4";
  assert.equal(engineFor(null, undefined), "v4");
  assert.equal(engineFor({ email: "second@x.io" }, "v3"), "v3");
  assert.equal(engineFor({ email: "x@y.z" }, "v3"), "v4");
  process.env.OWNER_USER_IDS = "8fdf054a-dc0d-4ed3-8a31-d77cf7ba4cf8";
  assert.equal(isOwner({ id: "8fdf054a-dc0d-4ed3-8a31-d77cf7ba4cf8" }), true);
  assert.equal(isOwner({ id: "00000000-dc0d-4ed3-8a31-d77cf7ba4cf8" }), false);
  process.env = old;
});
