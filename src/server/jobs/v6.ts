/**
 * Engine v6 jobs: the PLAN step (a job that ends with outline cards + three styles + their previews) and the deck
 * job made from an approved plan. Everything the deck job needs (brief, research, planned slots, style tokens)
 * travels inside the job's request, so it survives a restart and a sleeping free server.
 */
import fs from "fs";
import path from "path";
import { DATA_ROOT } from "../paths";
import { storage } from "../storage";
import { makeToken, readToken } from "../secret";
import { createJob } from "./manager";
import type { JobRecord, JobView } from "./types";
import { runPlanV6, cardsOf, applyCards, type PlanCard, type PlanData } from "@/engine-v6/plan";
import { generateStyles, type StyleTokens } from "@/engine-v6/style";
import { renderStylePreviews, previewSlideOf } from "@/engine-v6/preview";
import { presenterFields } from "@/engine-v3/privacy";
import { llmContext } from "@/engine-v3/llm";
import type { V6Input } from "@/engine-v5/pipeline";

const planDir = (jobId: string) => path.join(DATA_ROOT, "plans", jobId.replace(/[^a-z0-9-]/gi, ""));

export function stylePreviewToken(jobId: string) {
  return makeToken({ j: jobId, s: "style" }, 24 * 3600);
}
export function hasStylePreviewToken(t: string, jobId: string) {
  const d = readToken<{ j: string; s: string }>(t);
  return !!d && d.j === jobId && d.s === "style";
}

function styleSummaries(jobId: string, data: PlanData, files: Map<string, string[]>) {
  const t = stylePreviewToken(jobId);
  return data.styles.map((s) => ({
    id: s.id,
    name: s.name,
    why: s.why,
    dark: s.dark,
    palette: s.palette,
    font: s.font,
    previews: (files.get(s.id) || []).map((f) => `/api/v3/jobs/${jobId}/style/${path.basename(f)}?t=${t}`),
  }));
}

async function previewsFor(jobId: string, data: PlanData, req: JobRecord["request"], styles: StyleTokens[]) {
  const out = await renderStylePreviews(styles, { slides: data.slides, title: data.brief.title, language: data.brief.language, deckType: data.brief.deckType, fields: presenterFields(req.presenter) }, planDir(jobId));
  return new Map(out.map((p) => [p.id, p.files]));
}

function existingPreviews(jobId: string, data: PlanData): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const dir = planDir(jobId);
  const list = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const s of data.styles) m.set(s.id, list.filter((f) => f.startsWith(`${s.id}-`) && f.endsWith(".jpg")).sort((a, b) => parseInt(a.split("-").pop()!) - parseInt(b.split("-").pop()!)).map((f) => path.join(dir, f)));
  return m;
}

/** the plan step's job body (inside the manager's runner + AI context) */
export async function runPlanJob(job: JobRecord, save: () => void) {
  const log = (step: string, pct: number, agent: string, msg: string) => {
    job.progress.stage = pct < 45 ? "research" : "outline";
    job.progress.step = step;
    job.progress.percent = Math.max(job.progress.percent, pct);
    job.progress.log.push({ t: new Date().toISOString(), agent, msg });
    if (job.progress.log.length > 40) job.progress.log.splice(0, job.progress.log.length - 40);
    console.log(`[v6 plan ${job.id}] ${agent}: ${msg}`);
    save();
  };
  const data = await runPlanV6(job.request, log);
  log("Showing styles made for your topic", 88, "Style", "Drawing your title slide and one content slide in each style");
  const files = await previewsFor(job.id, data, job.request, data.styles);
  job.title = data.brief.title;
  const calls = llmContext.getStore()?.stats || [];
  (data as any).planCalls = calls.length;
  (data as any).planUsage = calls.reduce((m: Record<string, number>, c: any) => ((m[c.role] = (m[c.role] || 0) + 1), m), {});
  job.request.v6 = { stage: "plan", data };
  job.progress.plan = { cards: cardsOf(data), styles: styleSummaries(job.id, data, files), previewSlide: previewSlideOf(data.slides)?.n };
}

async function ownedPlanJob(jobId: string, ownerKey: string): Promise<JobRecord | null> {
  const j = await storage().getJob(jobId);
  if (!j || j.request.v6?.stage !== "plan" || j.status !== "done" || !j.request.v6.data) return null;
  const isOwner = j.userId ? ownerKey === `u:${j.userId}` : j.ownerKey === ownerKey;
  return isOwner ? j : null;
}

/** a style preview image (re-drawn from the tokens if the server restarted since) */
export async function stylePreviewFile(jobId: string, file: string): Promise<string | null> {
  if (!/^[a-z0-9-]+-\d+\.jpg$/i.test(file)) return null;
  const f = path.join(planDir(jobId), file);
  if (fs.existsSync(f)) return f;
  const j = await storage().getJob(jobId);
  const data: PlanData | undefined = j?.request.v6?.data;
  if (!j || !data) return null;
  await previewsFor(jobId, data, j.request, data.styles);
  return fs.existsSync(f) ? f : null;
}

/** "Suggest another": three more styles for the same topic, different from the ones already shown (one AI call) */
export async function moreStyles(jobId: string, ownerKey: string): Promise<JobView["progress"]["plan"] | null> {
  const j = await ownedPlanJob(jobId, ownerKey);
  if (!j) return null;
  const data: PlanData = j.request.v6!.data;
  if (data.styles.length >= 12) return j.progress.plan || null;
  const fresh = await generateStyles(data.brief, { count: 3, avoid: data.styles });
  const add = fresh.filter((s) => !data.styles.some((o) => o.id === s.id));
  data.styles = [...add, ...data.styles];
  await previewsFor(jobId, data, j.request, add);
  j.progress.plan = { ...(j.progress.plan as any), styles: styleSummaries(jobId, data, existingPreviews(jobId, data)) };
  await storage().saveJob(j);
  return j.progress.plan;
}

/** The student approved the plan (maybe edited) and chose a style ("surprise" = the art director's own pick). */
export async function approvePlan(jobId: string, ownerKey: string, userId: string | undefined, body: any): Promise<{ job?: JobView; error?: string; status?: number }> {
  const j = await ownedPlanJob(jobId, ownerKey);
  if (!j) return { error: "This plan was not found.", status: 404 };
  const data: PlanData = j.request.v6!.data;
  const cards: PlanCard[] = (Array.isArray(body?.cards) ? body.cards : cardsOf(data)).slice(0, 24).map((c: any) => ({
    id: typeof c?.id === "string" ? c.id.slice(0, 12) : "",
    title: String(c?.title || "").replace(/\s+/g, " ").trim().slice(0, 140),
    points: (Array.isArray(c?.points) ? c.points : []).map((p: any) => String(p || "").replace(/\s+/g, " ").trim().slice(0, 300)).filter(Boolean).slice(0, 8),
    layout: "",
    sources: [],
    fixed: ["title", "references", "closing"].includes(c?.fixed) ? c.fixed : undefined,
  }));
  if (cards.filter((c) => !c.fixed).length < 1) return { error: "Keep at least one content slide.", status: 400 };
  const styleId = typeof body?.styleId === "string" && data.styles.some((s) => s.id === body.styleId) ? body.styleId : null;
  const im = body?.imageMode;
  const imageMode = im === "none" ? "none" : im === "ai" || im === "ai-allowed" ? "ai-allowed" : "real-first";
  const request = { ...j.request, imageMode, slideCount: cards.length, engine: "v6" as const, v6: { stage: "deck" as const, planJobId: j.id, data, cards, styleId } };
  try {
    const job = await createJob(request as any, j.ownerKey, userId || j.userId);
    return { job };
  } catch (e: any) {
    return { error: e?.message || "Could not start the deck.", status: 429 };
  }
}

/** the deck job's input: the approved cards applied to the plan (one AI call only when cards were edited) */
export async function deckInputV6(job: JobRecord, say: (m: string) => void): Promise<V6Input> {
  const v = job.request.v6;
  if (!v?.data) return {};
  const data: PlanData = v.data;
  const { slides, rewritten } = await applyCards(data, Array.isArray(v.cards) && v.cards.length ? v.cards : cardsOf(data), say);
  const style = data.styles.find((s) => s.id === v.styleId) || data.styles[0];
  // the heavy plan data is not needed in the stored record any more once the deck exists
  return { pre: { brief: { ...data.brief, slideCount: slides.length }, research: data.research, slides, requests: data.requests, repaired: [...data.repaired, ...(rewritten ? [`${rewritten} slide(s) re-written from your edits`] : [])] }, style, note: v.styleId ? "chosen" : "surprise" };
}
