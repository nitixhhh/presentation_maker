/**
 * Engine v4 — the parent PLANNER agent. Short strict prompt + tools (read_skill, assign_slide, finish_plan): it reads
 * the planner skill on demand, plans the story and the layout variety, and writes one brief per slide for the designer
 * agents. The slide count is ENFORCED in code (models drift: one made 11 slides for 10); gaps are asked for again and
 * finally filled from the classic outline agent.
 */
import { chat, type Msg, type ToolCall } from "../engine-v3/llm";
import { runOutline, stripFactIds } from "../engine-v3/agents/outline";
import type { Brief, Outline, OutlineSlide, ResearchPack } from "../engine-v3/types";
import { readSkill, layoutIds } from "./skills";
import type { SlideBrief } from "./designerAgent";

const VISUALS = ["photo", "generated", "diagram", "chart", "icons", "none"];
const DIAGRAMS = ["flow", "cycle", "hub", "layers", "timeline", "compare", "tree", "matrix", "sequence", "mermaid", "bars", "line", "donut", "stacked"];

export function plannerTools() {
  return [
    {
      type: "function",
      function: {
        name: "read_skill",
        description: "Read a skill file: 'planner.md' (how to plan + brief), 'academic.md', 'principles.md', 'INDEX.md', or a layout file 'layouts/<id>.md'.",
        parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      },
    },
    {
      type: "function",
      function: {
        name: "assign_slide",
        description: "Plan ONE slide and brief its designer agent. Call once per slide (several in one turn is best).",
        parameters: {
          type: "object",
          properties: {
            n: { type: "integer", description: "slide number, 1-based" },
            role: { type: "string", description: "title, agenda, concept, process, comparison, data, case, timeline, summary, references, closing …" },
            layout: { type: "string", enum: layoutIds() },
            title: { type: "string", description: "≤ 10 words; the takeaway for content slides" },
            key_message: { type: "string" },
            points: { type: "array", items: { type: "object", properties: { text: { type: "string" }, fact_ids: { type: "array", items: { type: "string" } } }, required: ["text"] } },
            visual: {
              type: "object",
              properties: {
                kind: { type: "string", enum: VISUALS },
                photo_query: { type: "string", description: "2–4 English words for a real photo (kind photo)" },
                ai_prompt: { type: "string", description: "one sentence (kind generated)" },
                diagram: { type: "string", enum: DIAGRAMS },
                idea: { type: "string", description: "what the diagram/chart/visual shows" },
                icons: { type: "array", items: { type: "string" }, description: "2–5 icon concepts, e.g. rocket, planet, cpu" },
              },
              required: ["kind"],
            },
            designer_brief: { type: "string", description: "≤ 60 words for the designer: composition, emphasis, what to highlight" },
            notes: { type: "string", description: "2–4 sentences the presenter says" },
          },
          required: ["n", "role", "layout", "title", "points", "visual"],
        },
      },
    },
    { type: "function", function: { name: "finish_plan", description: "Call when every slide 1..N is assigned.", parameters: { type: "object", properties: {} } } },
  ];
}

function systemPrompt(n: number): string {
  return `You are the DeckCraft planner (parent agent). You plan a whole slide deck and brief one designer agent per slide with assign_slide. You never write HTML.
Steps: 1) read_skill("planner.md") (and "academic.md" for a class/university deck). 2) Call assign_slide for EVERY slide 1..${n} — several per turn. 3) finish_plan.
Rules:
- EXACTLY ${n} slides, numbered 1..${n}. Slide 1 = role "title". Slide ${n} = role "references" (the engine fills it with the real sources; leave points empty)${n >= 8 ? `, or make slide ${n - 1} "references" and slide ${n} "closing"` : ""}.
- One idea per slide; titles ≤ 10 words. Content slides carry 3–5 points of 8–16 words, each with SUBSTANCE from the RESEARCHED FACTS: a name, year, number, mechanism, example or consequence (attach fact_ids). "Few civilizations reach posthuman stage" is too thin; "Bostrom (2003): almost all civilizations may go extinct before reaching a posthuman stage" is right. Never invent numbers, dates, names or sources.
- Timeline / process slides: 4–6 dated events or steps in true chronological order, each with its date or period from the facts (never guess a period such as "Ancient" for a 1641 work). Agenda: one short item per section. Closing slide: 2–3 distinct take-aways (never repeat a sentence), no new claims.
- Every content slide needs a real visual: a photo only when a concrete, on-topic subject exists (never product, brand or logo shots); otherwise a diagram, chart, big number or icon set. The title slide needs a hero visual (photo_query of the subject, or an icon/diagram composition).
- Vary layouts: never the same layout on neighbouring slides, no layout more than twice. Mix photo, diagram/chart, icon cards and big-number slides. A chart only with ≥ 3 real numbers from the facts.
- Photos only for concrete physical subjects; icons are real SVG icons (give 2–5 concepts).
- Write all slide text in the deck language; photo_query/ai_prompt/icons stay in English.
- Presenter details are placeholders filled by the engine; never write names yourself.`;
}

function userPrompt(brief: Brief, research: ResearchPack): string {
  const facts = research.facts.map((f) => `${f.id}: ${f.text}`).join("\n");
  const terms = research.keyTerms.map((k) => `${k.term} — ${k.meaning}`).join("\n");
  return `BRIEF
Title: ${brief.title}${brief.subtitle ? ` — ${brief.subtitle}` : ""}
Deck type: ${brief.deckType}; level: ${brief.level}; subject: ${brief.subject}; goal: ${brief.goal}
Language: ${brief.language}
Slide count: ${brief.slideCount} (exactly)
Required sections (in order): ${brief.requiredSections.join(" → ") || "-"}
Tone: ${brief.tone}; imagery: ${brief.imagery}${brief.styleHint ? `; style: ${brief.styleHint}` : ""}
Title slide fields given by the student: ${brief.titleSlideFields.map((f) => f.label).join(", ") || "none"}

RESEARCHED FACTS (cite by id)
${facts || "(no facts found — keep points general and conceptual, no numbers)"}

KEY TERMS
${terms || "-"}

LAYOUTS: ${layoutIds().join(", ")}`;
}

function parseArgs(tc: ToolCall): any {
  try {
    return JSON.parse(tc.function.arguments || "{}");
  } catch {
    const m = String(tc.function.arguments || "").match(/\{[\s\S]*\}/);
    try {
      return m ? JSON.parse(m[0]) : null;
    } catch {
      return null;
    }
  }
}

function toBrief(a: any, factIds: Set<string>): SlideBrief | null {
  const n = Number(a?.n);
  if (!Number.isInteger(n) || n < 1 || !a?.title) return null;
  const v = a.visual || {};
  const kind = VISUALS.includes(String(v.kind)) ? String(v.kind) : "none";
  const layouts = layoutIds();
  let layout = String(a.layout || "").replace(/^layouts\//, "").replace(/\.md$/, "");
  if (!layouts.includes(layout)) layout = layouts.find((l) => l.includes(layout) && layout.length > 3) || "";
  return {
    n,
    role: String(a.role || "concept").toLowerCase().trim(),
    layout,
    title: stripFactIds(String(a.title).trim()).slice(0, 140),
    keyMessage: stripFactIds(String(a.key_message || a.keyMessage || "").trim()).slice(0, 240),
    points: (Array.isArray(a.points) ? a.points : [])
      .map((p: any) => (typeof p === "string" ? { text: p } : p))
      .filter((p: any) => p?.text)
      .slice(0, 6)
      .map((p: any) => ({ text: stripFactIds(String(p.text)).slice(0, 220), factIds: (p.fact_ids || p.factIds || []).map(String).filter((id: string) => factIds.has(id)) })),
    visual: { kind, query: v.photo_query || v.query, prompt: v.ai_prompt || v.prompt, idea: v.idea, diagram: DIAGRAMS.includes(String(v.diagram)) ? String(v.diagram) : undefined, icons: Array.isArray(v.icons) ? v.icons.map(String).slice(0, 6) : [] },
    designerBrief: String(a.designer_brief || a.designerBrief || "").slice(0, 600),
    notes: String(a.notes || "").slice(0, 900),
  };
}

export interface PlanResult {
  outline: Outline;
  briefs: SlideBrief[];
  requests: number;
  provider?: string;
  model?: string;
  repaired: string[];
}

/** outline slide (v3 shape: images, references, citations, exports all read it) from a v4 brief */
export function outlineFromBrief(b: SlideBrief): OutlineSlide {
  const kind = b.visual.kind === "icons" ? "none" : b.visual.kind;
  return {
    n: b.n,
    role: b.role,
    title: b.title,
    keyMessage: b.keyMessage,
    points: b.points,
    visual: { kind: kind as any, query: b.visual.query, prompt: b.visual.prompt, idea: [b.visual.diagram ? `${b.visual.diagram} diagram` : "", b.visual.idea || ""].filter(Boolean).join(": ") || undefined },
    notes: b.notes,
  };
}

export async function runPlanner(brief: Brief, research: ResearchPack, log: (m: string) => void = () => {}): Promise<PlanResult> {
  const N = brief.slideCount;
  const factIds = new Set(research.facts.map((f) => f.id));
  const tools = plannerTools();
  const messages: Msg[] = [
    { role: "system", content: systemPrompt(N) },
    { role: "user", content: userPrompt(brief, research) },
  ];
  const byN = new Map<number, SlideBrief>();
  let requests = 0, provider: string | undefined, model: string | undefined;
  let finished = false;
  const repaired: string[] = [];
  const maxTurns = Number(process.env.V4_PLANNER_TURNS || 8);
  for (let turn = 0; turn < maxTurns; turn++) {
    let r;
    try {
      r = await chat("planner", messages, { tools, temperature: 0.4, maxTokens: 12000, timeoutMs: 240_000, label: `v4 planner turn ${turn + 1}` });
    } catch (e: any) {
      log(`planner call failed: ${String(e?.message || e).slice(0, 120)}`);
      break;
    }
    requests++;
    provider = r.provider;
    model = r.model;
    const tcs = r.toolCalls || [];
    messages.push({ role: "assistant", content: r.text || null, ...(tcs.length ? { tool_calls: tcs } : {}) });
    if (!tcs.length) {
      messages.push({ role: "user", content: `Use the tools: call assign_slide for every slide 1..${N}, then finish_plan.` });
      continue;
    }
    for (const tc of tcs) {
      const a = parseArgs(tc);
      let res = "ok";
      if (!a) res = "Error: arguments were not valid JSON";
      else if (tc.function.name === "read_skill") res = readSkill(String(a.name || "planner.md"));
      else if (tc.function.name === "assign_slide") {
        const b = toBrief(a, factIds);
        if (!b) res = "Error: needs n, title, layout, points and visual";
        else if (b.n > N) res = `Error: slide ${b.n} does not exist — the deck has exactly ${N} slides (1..${N}). Merge this content into another slide.`;
        else {
          byN.set(b.n, b);
          res = `Slide ${b.n} assigned (${b.layout || "layout chosen by designer"}).`;
          log(`slide ${b.n}: ${b.title} [${b.layout || b.visual.kind}]`);
        }
      } else if (tc.function.name === "finish_plan") {
        const missing = Array.from({ length: N }, (_, i) => i + 1).filter((i) => !byN.has(i));
        if (missing.length) res = `Not finished: slides ${missing.join(", ")} are not assigned yet. Assign them now (exactly ${N} slides).`;
        else {
          finished = true;
          res = "Plan accepted.";
        }
      } else res = `Error: unknown tool ${tc.function.name}`;
      messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: res.length > 12000 ? res.slice(0, 12000) : res });
    }
    if (finished) break;
    const missing = Array.from({ length: N }, (_, i) => i + 1).filter((i) => !byN.has(i));
    if (!missing.length && turn >= 1) break; // all slides assigned; finish_plan is a formality
  }

  // ── enforce the plan in code ─────────────────────────────────────────────────
  let missing = Array.from({ length: N }, (_, i) => i + 1).filter((i) => !byN.has(i));
  if (missing.length) {
    repaired.push(`planner left slides ${missing.join(", ")} — filled from the outline agent`);
    log(`filling slides ${missing.join(", ")} from the outline agent`);
    try {
      const o = await runOutline({ ...brief, slideCount: N }, research);
      requests++;
      for (const n of missing) {
        const s = o.slides.find((x) => x.n === n) || o.slides[Math.min(o.slides.length - 1, n - 1)];
        if (!s) continue;
        byN.set(n, { n, role: n === 1 ? "title" : s.role, layout: "", title: s.title, keyMessage: s.keyMessage, points: s.points, visual: { kind: s.visual.kind, query: s.visual.query, prompt: s.visual.prompt, idea: s.visual.idea, icons: [] }, designerBrief: "", notes: s.notes });
      }
    } catch (e: any) {
      log(`outline fallback failed: ${String(e?.message || e).slice(0, 120)}`);
    }
    missing = Array.from({ length: N }, (_, i) => i + 1).filter((i) => !byN.has(i));
    for (const n of missing) byN.set(n, { n, role: "concept", layout: "", title: brief.requiredSections[n - 2] || brief.title, keyMessage: "", points: [], visual: { kind: "none", icons: [] }, designerBrief: "", notes: "" });
  }
  const briefs = Array.from({ length: N }, (_, i) => byN.get(i + 1)!);
  // slide 1 is always the title slide; exactly one references slide (last, or before a closing slide)
  briefs[0] = { ...briefs[0], role: "title", layout: briefs[0].layout || "title" };
  if (research.sources.length && !briefs.some((b) => b.role === "references")) {
    const ri = briefs.findIndex((b, i) => i > 0 && /referenc|bibliograph|sources|संदर्भ/i.test(b.title));
    const idx = ri > 0 ? ri : briefs[N - 1].role === "closing" && N > 4 ? N - 2 : N - 1;
    briefs[idx] = { ...briefs[idx], role: "references", layout: "references", title: brief.language === "Hindi" ? "संदर्भ (References)" : "References", keyMessage: "", points: [], visual: { kind: "none", icons: [] } };
    repaired.push(`slide ${idx + 1} made the references slide`);
  }
  let refSeen = false;
  for (let i = 0; i < briefs.length; i++) {
    if (briefs[i].role === "references") {
      if (refSeen) briefs[i] = { ...briefs[i], role: "summary" };
      refSeen = true;
      briefs[i] = { ...briefs[i], points: [], layout: "references" };
    }
  }
  // layout variety: no identical neighbours (the designer may still adapt)
  for (let i = 1; i < briefs.length; i++) if (briefs[i].layout && briefs[i].layout === briefs[i - 1].layout && !["references"].includes(briefs[i].layout)) {
    repaired.push(`slide ${i + 1}: same layout as slide ${i} — designer told to vary`);
    briefs[i] = { ...briefs[i], designerBrief: `${briefs[i].designerBrief} The previous slide already uses the ${briefs[i].layout} layout: choose a clearly different composition.`.trim() };
  }
  const outline: Outline = { slides: briefs.map(outlineFromBrief) };
  return { outline, briefs, requests, provider, model, repaired };
}
