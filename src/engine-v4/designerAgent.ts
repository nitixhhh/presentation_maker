/**
 * Engine v4 — one designer AGENT per slide. A short strict prompt + tools (read_skill, search_icons, get_icon,
 * search_photos, make_diagram, check_slide, submit_slide); the agent reads only the skills it needs, places real
 * icons/diagrams/photos, checks its own render (DOM geometry + contrast + vision) and submits. Turns are capped;
 * models fail over through the shared scheduler (llm.ts, role "agent").
 */
import fs from "fs";
import path from "path";
import { chat, chatJson, type Msg, type ToolCall } from "../engine-v3/llm";
import { designerSystemPrompt, designerUserPrompt, sanitize, designSlide, type DesignOut } from "../engine-v3/agents/designer";
import { inspectSlide, type Inspection } from "../engine-v3/qa/inspect";
import { ensureFields, fillPlaceholders, maskText, missingPlaceholders, type Field } from "../engine-v3/privacy";
import { searchCommons, searchWikipediaLead, searchNasa, searchOpenverse, download, store, type Candidate } from "../engine-v3/assets/images";
import { assetDir } from "../engine-v3/store";
import type { Asset, Deck, OutlineSlide } from "../engine-v3/types";
import { readSkill, layoutIds } from "./skills";
import { ICON_TOOL_DEFS, handleIconTool } from "./icons/icons";
import { collapseIcons, expandIcons, iconsInHtml, resolveIconName } from "./iconRender";
import { makeDiagram, ALL_KINDS } from "./diagrams";

export interface SlideBrief {
  n: number;
  role: string;
  layout: string;
  title: string;
  keyMessage: string;
  points: { text: string; factIds?: string[] }[];
  visual: { kind: string; query?: string; prompt?: string; idea?: string; diagram?: string; icons?: string[] };
  designerBrief: string;
  notes?: string;
}

export interface AgentResult extends DesignOut {
  turns: number;
  requests: number;
  submitted: boolean;
  note?: string;
  checks: number;
  lastInspection?: Inspection;
  lastVision?: { score: number; issues: string[]; fix: boolean } | null;
  iconsUsed: string[];
  fallback?: string;
}

export interface AgentCtx {
  deck: Deck;
  os: OutlineSlide;
  brief: SlideBrief;
  citeMap: Map<string, number>;
  allowedText: string;
  renderDir: string;
  status: (text: string) => void;
  /** a draft the agent submitted (shown to the user at once) */
  onSubmit?: (r: { html: string; notes: string }) => void;
  maxTurns?: number;
}

export const DESIGNER_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_skill",
      description: "Read a design skill file (INDEX.md lists them). E.g. 'workflow.md', 'layouts/timeline.md', 'icons.md', 'diagrams.md', 'mistakes.md'.",
      parameters: { type: "object", properties: { name: { type: "string", description: "file name, e.g. layouts/hub-and-spoke.md" } }, required: ["name"] },
    },
  },
  ...ICON_TOOL_DEFS,
  {
    type: "function",
    function: {
      name: "search_photos",
      description: "Find a real photo (Wikimedia Commons, Wikipedia, NASA, Openverse) for THIS slide. Returns asset ids you can use as <img src=\"asset:ID\">. Only for concrete, physical subjects.",
      parameters: { type: "object", properties: { query: { type: "string", description: "2–4 plain English words" }, orientation: { type: "string", enum: ["landscape", "portrait", "any"] } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "make_diagram",
      description:
        "Get ready-to-paste markup for a diagram or chart drawn by the engine in the deck's colours. kind: flow | cycle | hub (first item = centre) | layers | timeline | compare | tree (items with parent) | matrix (4 quadrants, axes) | sequence (actors + items with from/to) | bars | chart (chart: line|donut|stacked|bars; numbers from the brief only) | mermaid (code; branching flowcharts / state / sequence). Items may carry an icon concept (e.g. \"rocket\") — the engine draws it inside the node.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ALL_KINDS },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                desc: { type: "string" },
                value: { type: "number" },
                unit: { type: "string" },
                values: { type: "array", items: { type: "number" } },
                parent: { type: "string" },
                from: { type: "string" },
                to: { type: "string" },
                icon: { type: "string" },
                highlight: { type: "boolean" },
              },
            },
          },
          box: { type: "object", properties: { left: { type: "number" }, top: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, required: ["left", "top", "width", "height"] },
          chart: { type: "string", enum: ["line", "donut", "stacked", "bars"] },
          series: { type: "array", items: { type: "string" } },
          axes: { type: "object", properties: { x: { type: "string" }, y: { type: "string" } } },
          actors: { type: "array", items: { type: "string" } },
          code: { type: "string", description: "Mermaid code (kind mermaid only)" },
        },
        required: ["kind", "box"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_slide",
      description: "Render your HTML exactly as the user will see it and get the problems the engine measures (overflow, overlap, contrast, tiny text, unused icons…) plus a designer's visual review. Call before submit_slide.",
      parameters: { type: "object", properties: { html: { type: "string", description: "the full slide: <style>…</style> + markup" } }, required: ["html"] },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_slide",
      description: "Submit the finished slide. The user sees it immediately.",
      parameters: {
        type: "object",
        properties: {
          html: { type: "string" },
          notes: { type: "string", description: "3–5 spoken sentences the presenter says (deck language)" },
          note: { type: "string", description: "optional: one line on anything you could not solve" },
        },
        required: ["html", "notes"],
      },
    },
  },
];

function systemPrompt(deck: Deck): string {
  const ds = deck.design;
  const lang = deck.brief.language;
  return `You are a DeckCraft slide designer agent. You design ONE slide as HTML + CSS on a fixed 1280×720 canvas, using tools, then submit it. It must look designed by a skilled human: clear hierarchy, real icons, diagrams or photos, generous space — never a plain "title + bullets in a box".

How to work (call independent tools together in one turn):
1. read_skill("workflow.md") and read_skill("layouts/<your layout>.md"). Read more skills only when needed (engine.md = format + rules, icons.md, diagrams.md, images.md, typography-colour.md, mistakes.md, qa-checklist.md).
2. Visuals: search_icons for the concepts you will show; make_diagram for any diagram or chart (paste its markup unchanged); photos only from the assets listed in your brief or from search_photos.
3. Write the full HTML and call check_slide(html). Fix every high issue, then check again.
4. submit_slide(html, notes) once check_slide shows no high issue (after 3 checks, submit your best version with a note).

Hard rules:
- HTML = one <style> block (every selector starts with .slide) + the markup that goes inside <section class="slide">. No <script>, no external URLs, no emoji as icons, no position:fixed.
- Icons: <i class="ic" data-icon="ICON_ID"></i> (ids from search_icons), sized with CSS width/height, coloured with CSS color. Place every icon you searched for, or drop that idea.
- Content: only the text in your brief (you may tighten wording). Never invent numbers, dates, names, emails, URLs or sources. Keep citation markers as <sup>[2]</sup>. Write placeholders like {{P1}} exactly.
- Sizes: title 44–64px, body 24–30px, labels ≥ 18px, at most ~55 words of body text; text ≥ 56px from the edges; every word inside a text element (h1–h4, p, li, span, strong, small, figcaption, td).
- Colours: only the deck variables var(--bg) var(--surface) var(--ink) var(--muted) var(--primary) var(--accent) var(--accent2) (tints with color-mix are fine); text must contrast with what is behind it. Fonts: var(--font-heading), var(--font-body).
- Budget: at most ${12} turns. Always answer with tool calls, never with plain text.

DECK DESIGN SYSTEM — ${ds.name}: ${ds.mood}. ${ds.dark ? "Dark" : "Light"} theme. Palette: bg ${ds.palette.bg}, surface ${ds.palette.surface}, ink ${ds.palette.ink}, muted ${ds.palette.muted}, primary ${ds.palette.primary}, accent ${ds.palette.accent}, accent2 ${ds.palette.accent2}. Fonts: ${ds.font.heading} / ${ds.font.body}. Motif: ${ds.motif}. Rules: ${ds.rules.join(" | ") || "consistent margins, one accent per slide"}.
Language of all slide text: ${lang}${lang === "Hindi" ? " (Devanagari; technical terms may stay in English)" : lang === "Hinglish" ? " (Roman script)" : ""}.`;
}

function visualLine(b: SlideBrief, photos: Asset[], imagesOn: boolean): string {
  const v = b.visual || ({ kind: "none" } as SlideBrief["visual"]);
  const icons = (v.icons || []).filter(Boolean);
  const iconHint = icons.length ? ` Icon ideas: ${icons.join(", ")} (search_icons, then place them).` : "";
  switch (v.kind) {
    case "diagram":
      return `a ${v.diagram || "fitting"} diagram via make_diagram${v.idea ? ` — ${v.idea}` : ""}.${iconHint}`;
    case "chart":
      return `a chart via make_diagram (kind "chart" or "bars"), plotting ONLY numbers that appear in the points${v.idea ? ` — ${v.idea}` : ""}.${iconHint}`;
    case "icons":
      return `icon cards — one real icon per point.${iconHint || " Choose icon concepts that depict each point."}`;
    case "photo":
    case "generated":
      return photos.length
        ? `the photo asset(s) below, used like a designer (full-bleed with scrim, split, clipped shape…).${iconHint}`
        : imagesOn
        ? `a real photo — call search_photos("${v.query || b.title}"); if nothing fits, use a diagram, icons or a big-number composition instead.${iconHint}`
        : `no photos in this deck (images are off) — use icons, a diagram or strong typography.${iconHint}`;
    default:
      return `typography-led (big number, quote or bold composition).${iconHint}`;
  }
}

function userPrompt(ctx: AgentCtx): string {
  const { deck, os, brief, citeMap } = ctx;
  const photos = deck.assets.filter((a) => a.forSlides.includes(os.n) && a.origin !== "upload");
  let base = designerUserPrompt(deck, os, citeMap, []);
  base = base.replace(/\nVISUAL: [^\n]*/, `\nVISUAL: ${visualLine(brief, photos, deck.request.imageMode !== "none")}`);
  base = base.replace(/Design it now\. Output only <slide>…<\/slide><notes>…<\/notes>\.\s*$/, "");
  const layout = layoutIds().includes(brief.layout) ? brief.layout : "";
  return `${base.trim()}

PLANNER'S BRIEF FOR YOU
Layout: ${layout ? `${layout} (read layouts/${layout}.md)` : brief.layout || "your choice (read INDEX.md)"}
${brief.designerBrief ? `Brief: ${brief.designerBrief}` : ""}
Start now: read the skills you need, gather visuals, write the HTML, check_slide, submit_slide.`;
}

/** friendly live status for the user while this slide is built */
function statusFor(tc: { name: string; args: any }): string {
  const a = tc.args || {};
  switch (tc.name) {
    case "read_skill": {
      const n = String(a.name || "").replace(/\.md$/, "");
      if (n.startsWith("layouts/")) return `Reading the ${n.slice(8).replace(/-/g, " ")} layout guide…`;
      const m: Record<string, string> = { workflow: "Planning the slide step by step…", icons: "Reading the icon guide…", diagrams: "Reading the diagram guide…", images: "Reading the photo guide…", "typography-colour": "Choosing type sizes and colours…", mistakes: "Checking the list of common mistakes…", "qa-checklist": "Running the final checklist…", engine: "Reading the slide rules…", academic: "Checking academic conventions…", principles: "Reviewing design principles…", "charts-data": "Reading the chart guide…" };
      return m[n] || "Reading the design guide…";
    }
    case "search_icons":
      return `Finding icons: ${String(a.query || "").slice(0, 40)}…`;
    case "get_icon":
      return `Picking the icon ${String(a.name || "").split(":").pop()}…`;
    case "search_photos":
      return `Searching photos: ${String(a.query || "").slice(0, 40)}…`;
    case "make_diagram":
      return `Drawing the ${String(a.kind === "chart" ? a.chart || "chart" : a.kind || "").replace(/-/g, " ")} ${a.kind === "chart" ? "chart" : "diagram"}…`;
    case "check_slide":
      return "Checking text fits and contrast…";
    case "submit_slide":
      return "Final check before showing the slide…";
  }
  return "Working on the slide…";
}

function parseArgs(tc: ToolCall): any {
  try {
    return JSON.parse(tc.function.arguments || "{}");
  } catch {
    // some models wrap JSON in text or send single quotes
    const m = String(tc.function.arguments || "").match(/\{[\s\S]*\}/);
    try {
      return m ? JSON.parse(m[0]) : null;
    } catch {
      return null;
    }
  }
}

/** a model's HTML → the engine's slide markup (sanitised, <slide> wrapper / fences / doc shell removed) */
export function cleanAgentHtml(html: string): string {
  let h = String(html || "").trim();
  const fence = h.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) h = fence[1];
  h = h.replace(/<\/?slide>/gi, "").replace(/<notes>[\s\S]*?<\/notes>/gi, "");
  const body = h.match(/<section[^>]*class=["']?slide["']?[^>]*>([\s\S]*)<\/section>/i);
  if (body) {
    const styles = (h.match(/<style\b[\s\S]*?<\/style>/gi) || []).filter((s) => !body[1].includes(s)).join("\n");
    h = `${styles}\n${body[1]}`;
  }
  return sanitize(h);
}

async function visionCheck(shot: Buffer, ctx: AgentCtx): Promise<{ score: number; issues: string[]; fix: boolean } | null> {
  const { os, deck } = ctx;
  const prompt = `You are a strict senior presentation designer. Review this rendered 1280×720 slide ${os.n} ("${maskText(os.title, deck.brief.titleSlideFields || [])}", role ${os.role}) of a class deck about "${deck.brief.title}".
Look for: text cut off, overlapping or outside its panel; low contrast; awkward empty areas or crammed areas; plain "boxes with text" with no visual; icons/diagram unclear or not matching the theme; misalignment; anything broken.
Score 1–10 (7 = good enough to present, 9 = excellent). Reply ONLY JSON: {"score":8,"fix":false,"issues":["max 4 concrete fixes naming the element"]}`;
  try {
    const { data } = await chatJson<any>("agent", [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${shot.toString("base64")}` } }] }], { temperature: 0.1, maxTokens: 1500, timeoutMs: 120_000, label: `v4 vision ${os.n}` });
    const score = Math.max(1, Math.min(10, Number(data?.score) || 5));
    return { score, fix: !!data?.fix || score < 7, issues: (Array.isArray(data?.issues) ? data.issues : []).map(String).slice(0, 4) };
  } catch {
    return null;
  }
}

export async function runDesignerAgent(ctx: AgentCtx): Promise<AgentResult> {
  const { deck, os } = ctx;
  const fields: Field[] = deck.brief.titleSlideFields || [];
  const maxTurns = ctx.maxTurns ?? Number(process.env.V4_MAX_TURNS || 12);
  const imagesOn = deck.request.imageMode !== "none";
  const tools = DESIGNER_TOOLS.filter((t) => imagesOn || t.function.name !== "search_photos");
  const messages: Msg[] = [
    { role: "system", content: systemPrompt(deck) },
    { role: "user", content: userPrompt(ctx) },
  ];
  // the revision passes (v3 polish) get the classic designer contract + this slide's brief
  const revisionMessages: Msg[] = [
    { role: "system", content: designerSystemPrompt(deck.design, deck.brief) + `\n\nICONS: the slide uses real icons written as <i class="ic" data-icon="ID"></i> placeholders (the engine draws them). Keep them; you may move/resize/recolour them with CSS.` },
    { role: "user", content: designerUserPrompt(deck, os, ctx.citeMap, []).replace(/\nVISUAL: [^\n]*/, `\nVISUAL: ${visualLine(ctx.brief, deck.assets.filter((a) => a.forSlides.includes(os.n) && a.origin !== "upload"), imagesOn)}`) },
  ];
  const searched = new Map<string, string[]>(); // query → icon ids returned
  let requests = 0, checks = 0, submits = 0, visionCalls = 0;
  let provider = "", model = "";
  let best: { html: string; high: number; insp: Inspection; vision: AgentResult["lastVision"] } | null = null;
  let lastChecked: { src: string; html: string; insp: Inspection; vision: AgentResult["lastVision"] } | null = null;
  let submitted: { html: string; notes: string; note?: string } | null = null;
  let plainReplies = 0;

  const fill = (h: string) => {
    const withFields = os.role === "title" ? ensureFields(h, fields, missingPlaceholders(h, fields)) : h;
    return fillPlaceholders(withFields, fields);
  };
  const mask = (t: string) => maskText(t, fields);

  const unusedIcons = (html: string): string[] => {
    const used = new Set(iconsInHtml(html));
    const out: string[] = [];
    for (const [q, ids] of searched) if (ids.length && !ids.some((id) => used.has(id))) out.push(q);
    return out;
  };

  async function check(rawHtml: string, withVision: boolean) {
    const html = cleanAgentHtml(rawHtml);
    const filled = fill(html);
    const insp = await inspectSlide(deck, os.n, filled, ctx.renderDir, os.role, ctx.allowedText);
    const issues = insp.issues.slice();
    const exp = expandIcons(html);
    if (exp.missing.length) issues.push({ type: "icon-unknown", severity: "medium", detail: `No icon matches: ${exp.missing.join(", ")} — use ids from search_icons.` });
    const unused = unusedIcons(html);
    if (unused.length) issues.push({ type: "icons-unused", severity: "medium", detail: `You searched icons for ${unused.map((q) => `"${q}"`).join(", ")} but placed none of them. Place them (<i class="ic" data-icon="ID">) next to their text, or drop the idea.` });
    if (os.role !== "title" && os.role !== "references" && os.role !== "closing" && !/data-icon|v3-diagram|v4-mermaid|<img|<svg|background-image/i.test(html)) issues.push({ type: "no-visual", severity: "medium", detail: "The slide has no visual (icon, diagram, chart or photo) — add one that explains the content." });
    const high = issues.filter((i) => i.severity === "high").length;
    let vision: AgentResult["lastVision"] = null;
    if (withVision && high === 0 && visionCalls < 2) {
      visionCalls++;
      ctx.status("Looking at the slide like a designer…");
      vision = await visionCheck(insp.screenshot, ctx);
      requests++;
    }
    const rec = { src: html, html: collapseIcons(mask(insp.html)), insp: { ...insp, issues }, vision };
    lastChecked = rec;
    const score = high * 10 + issues.filter((i) => i.severity === "medium").length;
    if (!best || score < best.high) best = { html: rec.html, high: score, insp: rec.insp, vision };
    return rec;
  }

  function reportIssues(rec: { insp: Inspection; vision: AgentResult["lastVision"] }) {
    const iss = rec.insp.issues.filter((i) => i.severity !== "low").slice(0, 10).map((i) => ({ type: i.type, severity: i.severity, detail: mask(i.detail).slice(0, 240) }));
    const high = iss.filter((i) => i.severity === "high").length;
    return {
      ready: high === 0 && !(rec.vision && rec.vision.score < 6),
      high_issues: high,
      issues: iss,
      auto_fixed: rec.insp.autoFixes.slice(0, 6),
      visual_review: rec.vision ? { score: rec.vision.score, issues: rec.vision.issues.map(mask) } : undefined,
    };
  }

  async function runTool(tc: ToolCall): Promise<string> {
    const name = tc.function.name;
    const args = parseArgs(tc);
    if (args == null) return JSON.stringify({ error: "arguments were not valid JSON — call the tool again with a JSON object" });
    ctx.status(statusFor({ name, args }));
    try {
      switch (name) {
        case "read_skill":
          return readSkill(String(args.name || args.path || "INDEX.md"));
        case "search_icons": {
          const out = handleIconTool(name, args);
          try {
            searched.set(String(args.query || "").slice(0, 40), (JSON.parse(out).results || []).map((r: any) => r.id));
          } catch {}
          return out;
        }
        case "get_icon":
          return handleIconTool(name, args);
        case "search_photos":
          return JSON.stringify(await searchPhotos(deck, os.n, String(args.query || os.title), String(args.orientation || "any")));
        case "make_diagram": {
          const r = await makeDiagram(args, deck.design);
          if (!r.markup) return JSON.stringify({ error: r.warnings.join("; ") || "could not draw this diagram" });
          return JSON.stringify({ markup: r.markup, kind: r.kind, warnings: r.warnings, note: "Paste the markup into your slide unchanged (you may change left/top/width/height)." });
        }
        case "check_slide": {
          if (!args.html || String(args.html).length < 80) return JSON.stringify({ error: "html is missing or too short — pass the full slide" });
          checks++;
          const rec = await check(String(args.html), true);
          const rep = reportIssues(rec);
          if (rep.high_issues) ctx.status(`Fixing: ${rec.insp.issues.filter((i) => i.severity === "high").map((i) => i.type.replace(/-/g, " ")).slice(0, 2).join(", ")}…`);
          return JSON.stringify(rep);
        }
        case "submit_slide": {
          if (!args.html || String(args.html).length < 80) return JSON.stringify({ accepted: false, error: "html is missing — pass the full slide" });
          submits++;
          const html = cleanAgentHtml(String(args.html));
          const lc0 = lastChecked as { src: string; html: string; insp: Inspection; vision: AgentResult["lastVision"] } | null;
          const rec = lc0 && lc0.src === html ? lc0 : await check(html, false);
          const high = rec.insp.issues.filter((i) => i.severity === "high");
          if (high.length && submits < 3) return JSON.stringify({ accepted: false, reason: "the slide still has high-severity problems — fix them and submit again", ...reportIssues(rec) });
          submitted = { html: rec.html, notes: mask(String(args.notes || os.notes || "")), note: args.note ? String(args.note).slice(0, 200) : high.length ? `submitted with ${high.length} open issue(s)` : undefined };
          return JSON.stringify({ accepted: true });
        }
      }
      return JSON.stringify({ error: `unknown tool "${name}". Tools: ${tools.map((t) => t.function.name).join(", ")}` });
    } catch (e: any) {
      return JSON.stringify({ error: String(e?.message || e).slice(0, 200) });
    }
  }

  ctx.status("Reading the slide brief…");
  let turn = 0;
  for (; turn < maxTurns && !submitted; turn++) {
    if (turn === maxTurns - 3) messages.push({ role: "user", content: "3 turns left: check_slide your best HTML now and submit_slide right after." });
    if (turn === maxTurns - 1) messages.push({ role: "user", content: "Last turn: call submit_slide with your best HTML and notes now." });
    let r;
    try {
      r = await chat("agent", messages, { tools, temperature: 0.5, maxTokens: deck.brief.language === "Hindi" ? 16000 : 12000, timeoutMs: 240_000, label: `v4 slide ${os.n} turn ${turn + 1}` });
    } catch (e: any) {
      console.warn(`[v4] slide ${os.n}: agent call failed — ${String(e?.message || e).slice(0, 200)}`);
      break;
    }
    requests++;
    provider = r.provider;
    model = r.model;
    const tcs = r.toolCalls || [];
    messages.push({ role: "assistant", content: r.text || null, ...(tcs.length ? { tool_calls: tcs } : {}) });
    if (!tcs.length) {
      plainReplies++;
      // a model that answers with the slide as text: treat it as a check request on that HTML
      if (/<style|<div|<section/i.test(r.text) && plainReplies <= 2) {
        const rec = await check(r.text, false);
        messages.push({ role: "user", content: `Use the tools. I ran check_slide on the HTML in your reply: ${JSON.stringify(reportIssues(rec))}. Fix what is needed and call submit_slide(html, notes).` });
      } else messages.push({ role: "user", content: "Answer with tool calls only (read_skill, search_icons, make_diagram, check_slide, submit_slide)." });
      if (plainReplies > 3) break;
      continue;
    }
    // independent calls run together; checks/submits after them, in order
    const quick = tcs.filter((t) => !["check_slide", "submit_slide"].includes(t.function.name));
    const slow = tcs.filter((t) => ["check_slide", "submit_slide"].includes(t.function.name));
    const results = new Map<string, string>();
    await Promise.all(quick.map(async (t) => results.set(t.id, await runTool(t))));
    for (const t of slow) {
      if (submitted) {
        results.set(t.id, JSON.stringify({ accepted: true, note: "already submitted" }));
        continue;
      }
      results.set(t.id, await runTool(t));
    }
    for (const t of tcs) messages.push({ role: "tool", tool_call_id: t.id, name: t.function.name, content: clip(results.get(t.id) || "{}") });
  }

  const usedIcons = (h: string) => Array.from(new Set(iconsInHtml(h)));
  const sub = submitted as { html: string; notes: string; note?: string } | null;
  if (sub) {
    const html = fill(sub.html);
    ctx.status("Slide ready");
    ctx.onSubmit?.({ html, notes: fillPlaceholders(sub.notes, fields) });
    const lc = lastChecked as any;
    return { html, notes: fillPlaceholders(sub.notes || os.notes || "", fields), provider, model, messages: revisionMessages, turns: turn, requests, submitted: true, note: sub.note, checks, lastInspection: lc?.insp, lastVision: lc?.html === sub.html ? lc?.vision : null, iconsUsed: usedIcons(sub.html) };
  }
  const b = best as { html: string; insp: Inspection; vision: AgentResult["lastVision"] } | null;
  if (b) {
    ctx.status("Slide ready");
    return { html: fill(b.html), notes: fillPlaceholders(os.notes || "", fields), provider, model, messages: revisionMessages, turns: turn, requests, submitted: false, note: "turn limit reached — best checked version used", checks, lastInspection: b.insp, lastVision: b.vision, iconsUsed: usedIcons(b.html), fallback: "best-checked" };
  }
  // no usable HTML from the agent: the classic one-shot designer (a full design AI call, never a fixed template)
  ctx.status("Trying a second designer…");
  const d = await designSlide(deck, os, ctx.citeMap, 0, [], ctx.brief.designerBrief ? `PLANNER'S NOTE: ${ctx.brief.designerBrief}` : "");
  return { ...d, turns: turn, requests: requests + 1, submitted: false, checks, iconsUsed: [], fallback: "v3-designer" };
}

function clip(s: string, n = 14000): string {
  return s.length > n ? `${s.slice(0, n)}\n…(cut)` : s;
}

// ── search_photos ───────────────────────────────────────────────────────────────
async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

export async function searchPhotos(deck: Deck, n: number, query: string, orientation: string) {
  if (deck.request.imageMode === "none") return { error: "images are switched off for this deck — use icons, a diagram or typography" };
  const q = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 3) return { error: "query too short" };
  const lists = await Promise.all([withTimeout(searchCommons(q, 4), 12000, [] as Candidate[]), withTimeout(searchWikipediaLead(q, 2), 10000, [] as Candidate[]), withTimeout(searchNasa(q, 2), 8000, [] as Candidate[]), withTimeout(searchOpenverse(q, 2), 8000, [] as Candidate[])]);
  let cands = lists.flat().filter((c, i, a) => a.findIndex((x) => x.url === c.url) === i);
  const used = new Set(deck.assets.map((a) => a.sourceUrl));
  cands = cands.filter((c) => !used.has(c.sourceUrl));
  if (orientation === "landscape") cands.sort((a, b) => b.width / b.height - a.width / a.height);
  if (orientation === "portrait") cands.sort((a, b) => a.width / a.height - b.width / b.height);
  const dir = assetDir(deck.id);
  const out: any[] = [];
  for (const c of cands.slice(0, 5)) {
    if (out.length >= 2) break;
    const buf = await download(c.url, 15000);
    if (!buf) continue;
    const id = `p${n}_${deck.assets.length + 1}`;
    const s = await store(buf, dir, id);
    if (!s) continue;
    const a: Asset = { id, file: s.file, mime: "image/jpeg", width: s.width, height: s.height, avgColor: s.avgColor, origin: c.origin, title: c.title, description: c.description, credit: c.credit, sourceUrl: c.sourceUrl, forSlides: [n] };
    deck.assets.push(a);
    const ar = s.width / s.height;
    out.push({ asset: `asset:${id}`, size: `${s.width}×${s.height}`, shape: ar > 1.25 ? "landscape" : ar < 0.8 ? "portrait" : "square-ish", average_colour: s.avgColor, shows: c.description.slice(0, 160) });
  }
  if (!out.length) return { results: [], note: "no usable photo found — use icons, a diagram or a big-number composition instead (do not search more than twice)" };
  return { results: out, note: "Use as <img src=\"asset:ID\" style=\"object-fit:cover\"> or background-image:url(asset:ID). Credits go to the References slide automatically." };
}
