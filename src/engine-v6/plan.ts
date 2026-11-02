/**
 * Engine v6 — the PLAN step. Before anything is designed the student sees the story as editable outline cards
 * (title + points + a small source chip per slide), approves it, then picks a style. The plan job runs the brief,
 * research and the v6 planner (one call) plus the style director (one call, three styles for this topic); nothing
 * is designed yet. On approval, slides the student did not touch keep their planned slots (no extra AI); edited or
 * new slides are re-written together in ONE call that keeps the student's title and points.
 */
import { titleClamp } from "../engine-v5/planner";
import { runBrief } from "../engine-v3/agents/brief";
import { runResearch } from "../engine-v3/agents/research";
import { deepenResearch } from "../engine-v4/deepen";
import { boostScholarly } from "../engine-v5/scholarly";
import { chatJson } from "../engine-v3/llm";
import type { Brief, ResearchPack, V3Request } from "../engine-v3/types";
import { runPlannerV5, factsBlock, normalizeOne, problemsOf, resolveIcons, clamp, type PlannedSlide } from "../engine-v5/planner";
import { TEMPLATES, templateById } from "../engine-v5/templates";
import { inferFactIds } from "../engine-v5/cite";
import { slideText } from "../engine-v5/pipeline";
import { generateStyles, type StyleTokens } from "./style";

export interface PlanCard {
  /** stable id of the planned slide this card came from ("" for a card the student added) */
  id: string;
  title: string;
  points: string[];
  /** layout the engine planned (shown as a small label) */
  layout: string;
  beat?: string;
  /** short source names behind the slide's facts ("IMF", "Piketty 2014", "Wikipedia") */
  sources: string[];
  /** fixed slides (title, references, closing) cannot be moved or deleted */
  fixed?: "title" | "references" | "closing";
}

export interface PlanData {
  brief: Brief;
  research: ResearchPack;
  slides: (PlannedSlide & { id: string })[];
  styles: StyleTokens[];
  requests: number;
  repaired: string[];
}

const LAYOUT_NAMES: Record<string, string> = {
  "title-hero": "Title with photo", "title-split": "Title", "title-type": "Title", agenda: "Agenda", section: "Section", "big-stat": "Big number", "stats-row": "Key numbers",
  "cards-2": "Two cards", "cards-3": "Three cards", "cards-4": "Four cards", "icon-rows-photo": "Points + photo", "photo-split": "Photo + text", "photo-full": "Full photo",
  timeline: "Timeline", process: "Process", cycle: "Cycle", hub: "Hub diagram", layers: "Layers", comparison: "Comparison", "pros-cons": "Pros and cons", quote: "Quote",
  chart: "Chart", "chart-trend": "Growth chart", donut: "Donut chart", flowchart: "Flowchart", table: "Table", definition: "Definition", matrix: "2×2 matrix",
  diagram: "Flow / tree diagram", "text-focus": "Key statement", takeaways: "Takeaways", references: "References", closing: "Closing",
};
export const layoutName = (id: string) => LAYOUT_NAMES[id] || id;

/** the points a card shows for a planned slide (what the slide will say, in plain lines) */
export function pointsOf(s: PlannedSlide): string[] {
  const pts: string[] = [];
  if (s.lede && !/^title-/.test(s.template)) pts.push(s.lede);
  if (s.stat?.value) pts.push(`${s.stat.value} ${s.stat.label || ""}`.trim());
  for (const i of s.items || []) {
    const t = [i.label || i.value, i.title, i.text].filter(Boolean).join(" — ");
    if (t) pts.push(t);
  }
  if (s.left) pts.push(`${s.left.title}: ${s.left.points.join("; ")}`);
  if (s.right) pts.push(`${s.right.title}: ${s.right.points.join("; ")}`);
  if (s.chart?.items.length) pts.push(s.chart.items.map((i) => `${i.label} ${i.value}${s.chart!.unit || ""}`).join(", "));
  if (s.flow?.nodes.length) pts.push(s.flow.nodes.map((n) => n.label).join(" → "));
  if (s.table) pts.push(...s.table.rows.slice(0, 4).map((r) => r.join(" | ")));
  if (s.quote?.text) pts.push(`“${s.quote.text}”${s.quote.author ? ` — ${s.quote.author}` : ""}`);
  if (s.takeaway) pts.push(s.takeaway);
  if (/^title-/.test(s.template) && s.lede) pts.push(s.lede);
  return pts.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 7);
}

function sourceChip(src: ResearchPack["sources"][number]): string {
  const year = (src as any).year ? ` ${(src as any).year}` : "";
  if (src.kind === "wikipedia") return "Wikipedia";
  const authors = String((src as any).authors?.[0] || (src as any).author || "").split(/[ ,]+/).filter(Boolean);
  const last = authors.length ? authors[authors.length - 1] : "";
  if (last && last.length < 18) return `${last}${year}`;
  const pub = String((src as any).publisher || (src as any).site || (src as any).journal || "");
  if (pub && pub.length < 22) return `${pub}${year}`;
  return clamp(String(src.title || "Source"), 22);
}

export function cardsOf(data: Pick<PlanData, "slides" | "research">): PlanCard[] {
  const fs = new Map(data.research.facts.map((f) => [f.id, f.sources]));
  const srcs = new Map(data.research.sources.map((s) => [s.id, s]));
  return data.slides.map((s) => {
    const sids = [...new Set((s.factIds || []).flatMap((f) => fs.get(f) || []))];
    const chips = [...new Set(sids.map((id) => srcs.get(id)).filter(Boolean).map((x) => sourceChip(x!)))].slice(0, 3);
    return {
      id: s.id,
      title: s.title,
      points: s.template === "references" ? [] : pointsOf(s),
      layout: layoutName(s.template),
      beat: s.beat,
      sources: chips,
      fixed: s.n === 1 ? "title" : s.template === "references" ? "references" : s.template === "closing" ? "closing" : undefined,
    };
  });
}

/** brief → research → v6 plan → three styles. 4–6 AI calls (brief, research, paper check, planner, style). */
export async function runPlanV6(req: V3Request, log: (step: string, pct: number, agent: string, msg: string) => void): Promise<PlanData> {
  log("Understanding your brief", 5, "Brief", "Reading your topic and details");
  const brief = await runBrief(req);
  log("Understanding your brief", 12, "Brief", `${brief.deckType} · ${brief.level} · ${brief.slideCount} slides · ${brief.language}`);
  log("Researching real sources", 15, "Research", `Searching encyclopedias and research papers for: ${brief.researchQueries.join("; ")}`);
  const deep = await deepenResearch(brief, await runResearch(brief, (m) => log("Researching real sources", 22, "Research", m), req.topic), req.topic, (m) => log("Researching real sources", 30, "Research", m));
  const research = await boostScholarly(brief, deep, req.topic, (m) => log("Researching real sources", 38, "Research", m));
  log("Researching real sources", 45, "Research", `${research.facts.length} cited facts from ${research.sources.length} sources`);
  log("Planning the story", 50, "Planner", "Writing the story: question, evidence, answer");
  // the plan and the three styles do not depend on each other: both calls run at the same time
  const [plan, styles] = await Promise.all([
    runPlannerV5(brief, research, (m) => log("Planning the story", 60, "Planner", m), { v6: true }),
    generateStyles(brief, { count: 3, log: (m) => log("Planning the story", 70, "Style", m) }),
  ]);
  for (const s of plan.slides) {
    if ((s.factIds || []).length || /^title-/.test(s.template) || ["references", "closing", "agenda", "section"].includes(s.template)) continue;
    const inferred = inferFactIds(slideText(s), research.facts);
    if (inferred.length) s.factIds = inferred;
  }
  const slides = plan.slides.map((s) => ({ ...s, id: `s${s.n}` }));
  log("Planning the story", 80, "Planner", `${slides.length} slides: ${slides.map((s) => s.template).join(", ")}`);
  return { brief, research, slides, styles, requests: plan.requests, repaired: plan.repaired };
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x.trim() === String(b[i] || "").trim());

/**
 * The approved cards → planned slides. Untouched cards keep their slots; changed and new cards are re-written in ONE
 * call (keeping the student's title and points); title first, references and closing last, slides renumbered.
 */
export async function applyCards(data: PlanData, cards: PlanCard[], log: (m: string) => void = () => {}): Promise<{ slides: PlannedSlide[]; rewritten: number }> {
  const orig = new Map(data.slides.map((s) => [s.id, s]));
  const origCards = new Map(cardsOf(data).map((c) => [c.id, c]));
  const title = data.slides.find((s) => s.n === 1)!;
  const refs = data.slides.find((s) => s.template === "references");
  const closing = data.slides.find((s) => s.template === "closing");
  const body = cards.filter((c) => !c.fixed && (c.title.trim() || c.points.some((p) => p.trim()))).slice(0, 22);
  const titleCard = cards.find((c) => c.fixed === "title");
  const out: PlannedSlide[] = [];
  const t0: PlannedSlide = { ...title };
  if (titleCard && titleCard.title.trim() && titleCard.title.trim() !== title.title) t0.title = clamp(titleCard.title.trim(), 120);
  out.push(t0);
  const todo: { at: number; card: PlanCard; was?: PlannedSlide }[] = [];
  for (const c of body) {
    const o = c.id ? orig.get(c.id) : undefined;
    const oc = c.id ? origCards.get(c.id) : undefined;
    if (o && oc && oc.title.trim() === c.title.trim() && same(oc.points, c.points.filter((p) => p.trim()))) out.push({ ...o });
    else {
      todo.push({ at: out.length, card: c, was: o });
      out.push({ n: 0, template: "", role: "", title: c.title, missing: true } as PlannedSlide);
    }
  }
  if (refs) out.push({ ...refs });
  if (closing) out.push({ ...closing });
  if (todo.length) {
    log(`re-writing ${todo.length} slide(s) you changed or added`);
    const allowed = TEMPLATES.filter((t) => t.family !== "title" && !["references", "closing", "section", "agenda"].includes(t.id));
    try {
      const { data: d } = await chatJson<any>("planner", [
        { role: "system", content: `You write slides for a premium presentation from a student's EDITED outline. For each slide keep the student's title wording (you may tidy it into a full-sentence action title ≤ 70 chars only if it is a bare label) and say exactly what their points say — do not drop or replace their points, do not add unrelated ones. Pick the designer template whose shape fits the points best and fill its slots. Use real numbers only from the facts (cite their ids in fact_ids); never write URLs or fact ids in the text. Write in ${data.brief.language}. Templates and slots:\n${allowed.map((t) => `${t.id}: ${t.slots}`).join("\n")}\nReply with ONLY JSON: {"slides":[{"k":1,"template":"","title":"","eyebrow":"","lede":"","items":[],"stat":{},"left":{},"right":{},"chart":{},"flow":{},"table":{},"quote":{},"takeaway":"","term":"","center":"","axes":{},"fact_ids":[],"notes":""}]}` },
        { role: "user", content: `Deck: ${data.brief.title}. The full story in order:\n${out.map((s, i) => `${i + 1}. ${s.title}${todo.some((t) => t.at === i) ? "   ← WRITE THIS ONE" : ""}`).join("\n")}\n\nSlides to write:\n${todo.map((t, k) => `k=${k + 1} (slide ${t.at + 1}): title "${t.card.title}"\npoints:\n${t.card.points.filter((p) => p.trim()).map((p) => `- ${p}`).join("\n") || "- (none: write 3–4 strong points for this title)"}${t.was ? `\n(it was a ${t.was.template} slide)` : ""}`).join("\n\n")}\n\n${factsBlock(data.research).slice(0, 7000)}` },
      ], { temperature: 0.4, maxTokens: 6000, label: "v6 plan edits" });
      const got: any[] = Array.isArray(d?.slides) ? d.slides : [];
      todo.forEach((t, k) => {
        const raw = got.find((g) => Number(g?.k) === k + 1) || got[k];
        const one = raw ? normalizeOne({ ...raw, n: t.at + 1 }, data.brief, data.research) : null;
        if (one && !problemsOf(one).length && !/^title-|^references$|^closing$/.test(one.template)) {
          resolveIcons(one);
          out[t.at] = one;
        } else out[t.at] = fallbackCard(t.card, t.at + 1);
      });
    } catch (e: any) {
      log(`edit call failed (${String(e?.message || e).slice(0, 80)}) — your points go in as written`);
      for (const t of todo) out[t.at] = fallbackCard(t.card, t.at + 1);
    }
  }
  out.forEach((s, i) => {
    s.n = i + 1;
    s.missing = undefined;
    if (!s.role) s.role = templateById(s.template)?.family || "text";
  });
  return { slides: out, rewritten: todo.length };
}

/** the student's own words, as they wrote them, on the layout that fits the count */
function fallbackCard(c: PlanCard, n: number): PlannedSlide {
  const pts = c.points.map((p) => p.trim()).filter(Boolean).slice(0, 5);
  const tpl = pts.length === 3 ? "cards-3" : pts.length === 4 ? "cards-4" : pts.length >= 2 ? "takeaways" : "text-focus";
  const items = pts.map((p) => { const [a, ...b] = p.split(/\s[—:-]\s|:\s/); return b.length && a.length <= 34 ? { icon: "lightbulb", title: a, text: b.join(" ") } : { icon: "lightbulb", title: clamp(p, 34), text: p.length > 34 ? p : "" }; });
  const s: PlannedSlide = { n, role: "text", template: tpl, title: titleClamp(c.title), items, lede: tpl === "text-focus" ? pts[0] || c.title : undefined };
  resolveIcons(s);
  return s;
}
