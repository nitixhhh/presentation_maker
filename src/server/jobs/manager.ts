/**
 * Background generation jobs.
 *
 * - POST creates a job and returns its id at once; the deck is generated in this server process
 *   whether or not any client stays connected. Progress + result are persisted through the storage
 *   adapter (Supabase or local disk), so a phone that sleeps, loses network or reopens the app later
 *   simply reads the job again.
 * - Fair queue: at most MAX_CONCURRENT_JOBS decks generate at once (default 2). The next job to start
 *   is picked round-robin across owners (the owner with the fewest running jobs, then the oldest job),
 *   so one person queueing several decks cannot block everyone else. MAX_QUEUED_PER_OWNER caps it.
 * - Restart-safe: on boot, jobs that were queued or running are queued again (running ones restart).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { generateDeckV3 } from "@/engine-v3/pipeline";
import type { LiveOptions } from "@/engine-common/live";
import { generateDeckV5 } from "@/engine-v5/pipeline";
import { runPlanJob, deckInputV6 } from "./v6";
import { finalizePlaceholders, assertNoPlaceholdersInPptx } from "@/engine-common/finalize";
import { deckToken } from "../deckAuth";
import { llmContext, type CallStat } from "@/engine-v3/llm";
import { deckDir, loadDeck, saveDeck } from "@/engine-v3/store";
import { exportPdf } from "@/engine-v3/export/pdf";
import { exportPptx } from "@/engine-v3/export/pptx";
import { exportNotesPdf } from "@/engine-v3/export/notes";
import { editSlide } from "@/engine-v3/edit";
import { editSlideV5 } from "@/engine-v5/edit";
import { accounts } from "../accounts/store";
import { renderPngs } from "@/engine-v3/export/png";
import sharp from "sharp";
import type { V3Request } from "@/engine-v3/types";
import { storage } from "../storage";
import { canSeeJob } from "../access";
import type { JobRecord, JobStage, JobView } from "./types";
import { setActiveJobs } from "../keepAlive";

const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_JOBS || 2));
const MAX_QUEUED_PER_OWNER = Math.max(1, Number(process.env.MAX_QUEUED_PER_OWNER || 3));
const MAX_ATTEMPTS = 3;
const DEFAULT_DECK_SECONDS = 300;

type Listener = (v: JobView) => void;

interface State {
  jobs: Map<string, JobRecord>; // queued + running (in memory)
  running: Set<string>;
  listeners: Map<string, Set<Listener>>;
  durations: number[]; // seconds of recent finished decks
  ready: Promise<void> | null;
  lastSave: Map<string, number>;
  lastServed: Map<string, number>; // owner -> when their last job started (round-robin)
  pendingSave: Map<string, NodeJS.Timeout>;
}

declare global {
  var __deckcraftJobs: State | undefined;
}

const S: State =
  globalThis.__deckcraftJobs ||
  (globalThis.__deckcraftJobs = { jobs: new Map(), running: new Set(), listeners: new Map(), durations: [], ready: null, lastSave: new Map(), pendingSave: new Map(), lastServed: new Map() });

export class QueueFullError extends Error {}

function newJobId() {
  return `j${Date.now().toString(36)}${crypto.randomBytes(9).toString("hex")}`;
}

// ── persistence (throttled while running; immediate on state changes) ──────────────
async function persist(job: JobRecord, force = false) {
  const now = Date.now();
  const last = S.lastSave.get(job.id) || 0;
  if (!force && now - last < 1500) {
    if (!S.pendingSave.has(job.id))
      S.pendingSave.set(
        job.id,
        setTimeout(() => {
          S.pendingSave.delete(job.id);
          persist(job, true);
        }, 1500 - (now - last))
      );
    return;
  }
  const t = S.pendingSave.get(job.id);
  if (t) {
    clearTimeout(t);
    S.pendingSave.delete(job.id);
  }
  S.lastSave.set(job.id, now);
  try {
    await storage().saveJob(job);
  } catch (e) {
    console.error("[jobs] persist failed", job.id, e);
  }
}

// ── queue maths ───────────────────────────────────────────────────────────────
function avgDeckSeconds() {
  const d = S.durations.slice(-20);
  if (!d.length) return DEFAULT_DECK_SECONDS;
  return d.reduce((a, b) => a + b, 0) / d.length;
}

/** Queued jobs in the order they will start (fair round-robin by owner). */
function startOrder(): JobRecord[] {
  const queued = [...S.jobs.values()].filter((j) => j.status === "queued").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const load = new Map<string, number>();
  for (const id of S.running) {
    const j = S.jobs.get(id);
    if (j) load.set(j.ownerKey, (load.get(j.ownerKey) || 0) + 1);
  }
  // round-robin: fewest running jobs first, then the owner served longest ago, then the oldest job
  const served = new Map(S.lastServed);
  const order: JobRecord[] = [];
  const rest = [...queued];
  let tick = Date.now();
  while (rest.length) {
    let bestIdx = 0;
    for (let i = 1; i < rest.length; i++) {
      const a = rest[i], b = rest[bestIdx];
      const la = load.get(a.ownerKey) || 0, lb = load.get(b.ownerKey) || 0;
      if (la !== lb) {
        if (la < lb) bestIdx = i;
        continue;
      }
      const sa = served.get(a.ownerKey) || 0, sb = served.get(b.ownerKey) || 0;
      if (sa !== sb) {
        if (sa < sb) bestIdx = i;
        continue;
      }
      if (a.createdAt < b.createdAt) bestIdx = i;
    }
    const [j] = rest.splice(bestIdx, 1);
    order.push(j);
    load.set(j.ownerKey, (load.get(j.ownerKey) || 0) + 1);
    served.set(j.ownerKey, ++tick);
  }
  return order;
}

function remainingSeconds(j: JobRecord): number {
  const avg = avgDeckSeconds();
  if (j.status !== "running" || !j.startedAt) return avg;
  const elapsed = (Date.now() - Date.parse(j.startedAt)) / 1000;
  const p = Math.max(1, j.progress.percent);
  const linear = (elapsed * (100 - p)) / p;
  const hist = Math.max(0, avg - elapsed);
  const w = Math.min(1, p / 60); // trust the live rate more as the job advances
  return Math.max(10, Math.round(w * linear + (1 - w) * Math.max(hist, linear * 0.5)));
}

export function viewOf(j: JobRecord): JobView {
  const { ownerKey: _o, userId: _u, request, routes: _r, ...rest } = j;
  const v: JobView = { ...rest, topic: request.topic, slideCount: request.slideCount, engine: request.engine || "v3", ...(request.v6?.stage ? { stage: request.v6.stage } : {}) };
  // live slides (Standard/Advanced): signed preview links for the slides already made (the job view only reaches the job's owner)
  if (v.progress?.live && j.deckId) {
    let t = "";
    try {
      t = deckToken(j.deckId, "view");
    } catch {}
    v.progress = { ...v.progress, live: { ...v.progress.live, slides: v.progress.live.slides.map((s) => (s.v > 0 && t ? { ...s, image: `/api/v3/deck/${j.deckId}/preview/${s.n}?t=${t}&v=${s.v}` } : s)) } };
  }
  if (v.progress?.notice && Date.now() - (v.progress.noticeAt || 0) > 90_000) v.progress = { ...v.progress, notice: undefined };
  if (j.startedAt) v.elapsedSeconds = Math.round(((j.finishedAt ? Date.parse(j.finishedAt) : Date.now()) - Date.parse(j.startedAt)) / 1000);
  if (j.status === "running") v.etaSeconds = remainingSeconds(j);
  if (j.status === "queued") {
    const order = startOrder();
    const idx = order.findIndex((x) => x.id === j.id);
    v.queuePosition = idx + 1;
    // when will a slot free up for this job?
    const slotFree = [...S.running].map((id) => S.jobs.get(id)).filter(Boolean).map((r) => remainingSeconds(r!)).sort((a, b) => a - b);
    const avg = avgDeckSeconds();
    const ahead = idx - Math.max(0, MAX_CONCURRENT - S.running.size);
    let wait = 0;
    if (ahead >= 0) {
      const base = slotFree[ahead % Math.max(1, slotFree.length)] ?? 0;
      wait = base + Math.floor(ahead / MAX_CONCURRENT) * avg;
    }
    v.etaSeconds = Math.round(wait + avg);
  }
  return v;
}

function notify(j: JobRecord) {
  const set = S.listeners.get(j.id);
  if (set) for (const fn of set) fn(viewOf(j));
  // queue positions of everyone else may have changed
  if (j.status !== "running" || j.progress.percent === 0)
    for (const other of S.jobs.values()) if (other.id !== j.id && other.status === "queued") S.listeners.get(other.id)?.forEach((fn) => fn(viewOf(other)));
}

export function subscribe(jobId: string, fn: Listener): () => void {
  if (!S.listeners.has(jobId)) S.listeners.set(jobId, new Set());
  S.listeners.get(jobId)!.add(fn);
  return () => {
    S.listeners.get(jobId)?.delete(fn);
    if (!S.listeners.get(jobId)?.size) S.listeners.delete(jobId);
  };
}

// ── stage mapping from pipeline steps ─────────────────────────────────────────
function stageOf(step: string): JobStage {
  const s = step.toLowerCase();
  if (s.includes("brief") || s.includes("research")) return "research";
  if (s.includes("story") || s.includes("outline")) return "outline";
  if (s.includes("qa") || s.includes("quality")) return "qa";
  if (s.includes("done")) return "export";
  return "design";
}
const STAGE_RANK: Record<JobStage, number> = { queued: 0, research: 1, outline: 2, design: 3, qa: 4, export: 5, done: 6 };

// ── runner ────────────────────────────────────────────────────────────────────
async function run(job: JobRecord) {
  S.running.add(job.id);
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.attempt += 1;
  job.progress = { stage: "research", step: "Starting", percent: 1, log: job.progress.log || [] };
  await persist(job, true);
  notify(job);
  try {
    const stats: CallStat[] = [];
    const onWait = (msg: string) => {
      job.progress.notice = msg;
      job.progress.noticeAt = Date.now();
      persist(job);
      notify(job);
    };
    if (job.edit) {
      await runEdit(job, stats, onWait);
      return;
    }
    // engine v6 plan step: brief, research, the story and three styles — nothing is designed until the student approves
    if (job.request.v6?.stage === "plan") {
      await llmContext.run({ onWait, stats, routes: job.routes as any }, () => runPlanJob(job, () => { persist(job); notify(job); }));
      job.status = "done";
      job.finishedAt = new Date().toISOString();
      job.progress = { ...job.progress, stage: "done", step: "Your plan is ready", percent: 100 };
      return;
    }
    const onProgress = (p: import("@/engine-v3/types").ProgressEvent) => {
        const stage = stageOf(p.step);
        const pr = job.progress;
        // never go backwards (designers + QA run in parallel and report out of order)
        if (STAGE_RANK[stage] >= STAGE_RANK[pr.stage]) pr.stage = stage;
        pr.percent = Math.max(pr.percent, Math.min(92, Math.round(p.percent * 0.92)));
        pr.step = p.step;
        pr.details = p.details;
        if (p.log) {
          pr.log.push({ t: new Date().toISOString(), agent: p.log.agent, msg: p.log.action });
          if (pr.log.length > 40) pr.log.splice(0, pr.log.length - 40);
        }
        persist(job);
        notify(job);
    };
    const onDeckId = (id: string) => {
      job.deckId = id;
      persist(job, true);
    };
    const eng = job.request.engine === "v6" ? "v6" : job.request.engine === "v5" ? "v5" : "v3";
    // Standard (v5) and Advanced (v6) share the live slide-by-slide UI (each slide is shown the moment it is ready)
    const liveOpts = (eng: "v5" | "v6"): LiveOptions => ({
            visionMode: job.visionMode,
            onProgress,
            onDeckId,
            onPlan: (slides) => {
              job.progress.live = { engine: eng, slides: slides.map((s) => ({ n: s.n, title: s.title, state: "waiting", statuses: [], v: 0 })) };
              persist(job, true);
              notify(job);
            },
            onSlide: (e) => {
              const ls = job.progress.live?.slides.find((x) => x.n === e.n);
              if (!ls) return;
              // a slide already shown never goes back to "building"
              if (!(e.state === "building" && (ls.state === "ready" || ls.state === "polishing" || ls.state === "done"))) ls.state = e.state;
              if (e.status && ls.statuses[ls.statuses.length - 1] !== e.status) {
                ls.statuses.push(e.status);
                if (ls.statuses.length > 6) ls.statuses.splice(0, ls.statuses.length - 6);
              }
              if (e.preview) ls.v += 1;
              persist(job);
              notify(job);
            },
          });
    const deck = await llmContext.run({ onWait, stats, routes: job.routes as any }, () =>
      eng === "v6"
        ? deckInputV6(job, (m) => onProgress({ step: "Planning the story", percent: 26, log: { agent: "Planner", action: m, timestamp: new Date().toLocaleTimeString() } })).then((v6) => generateDeckV5(job.request, { ...liveOpts("v6"), v6 }))
        : eng === "v5"
        ? generateDeckV5(job.request, liveOpts("v5"))
        : generateDeckV3(job.request, { visionMode: job.visionMode, onProgress, onDeckId })
    );
    job.deckId = deck.id;
    job.title = deck.brief.title;
    if (job.kind !== "benchmark") {
      deck.ownerKey = job.ownerKey;
      saveDeck(deck);
    }

    // Export step: build the files once, store them, make the deck durable.
    job.progress.stage = "export";
    job.progress.step = "Exporting PDF and PPTX";
    job.progress.percent = Math.max(job.progress.percent, 93);
    persist(job, true);
    notify(job);
    await buildExports(deck.id);
    job.progress.percent = 98;
    job.progress.step = "Saving your deck";
    notify(job);
    await storage().persistDeck(deck.id, deckDir(deck.id));

    job.status = "done";
    job.finishedAt = new Date().toISOString();
    job.progress = { ...job.progress, stage: "done", step: "Your deck is ready", percent: 100 };
    S.durations.push((Date.parse(job.finishedAt) - Date.parse(job.startedAt!)) / 1000);
  } catch (e: any) {
    console.error("[jobs] failed", job.id, e);
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.error = friendlyError(e);
  } finally {
    S.running.delete(job.id);
    await persist(job, true);
    notify(job);
    S.jobs.delete(job.id);
    pump();
  }
}

async function runEdit(job: JobRecord, stats: CallStat[], onWait: (m: string) => void) {
  const e = job.edit!;
  await ensureDeckLocal(e.deckId);
  const deck = loadDeck(e.deckId);
  if (!deck) throw new Error("deck missing");
  job.deckId = deck.id;
  job.title = deck.brief.title;
  const emit = (step: string, percent: number, msg: string) => {
    job.progress = { ...job.progress, stage: "design", step, percent, log: [...job.progress.log, { t: new Date().toISOString(), agent: "Edit", msg }].slice(-40) };
    persist(job);
    notify(job);
  };
  // a v5 deck keeps its template: the slots are re-filled and re-rendered (the v3 designer edits every other deck)
  await llmContext.run({ onWait, stats }, () => ((deck as any).engine === "v5" || (deck as any).engine === "v6" ? editSlideV5(deck, e.n, e.instruction, emit) : editSlide(deck, e.n, e.instruction, emit)));
  emit("Rebuilding PDF and PPTX", 90, "exporting");
  await buildExports(deck.id);
  await storage().persistDeck(deck.id, deckDir(deck.id));
  await accounts().addEdit(deck.id); // counted only when the edit succeeded
  job.status = "done";
  job.finishedAt = new Date().toISOString();
  job.progress = { ...job.progress, stage: "done", step: "Slide updated", percent: 100 };
}

function friendlyError(e: any): string {
  const m = String(e?.message || e);
  if (/no configured provider|no (llm )?provider|no routes|api key/i.test(m)) return "The AI service is not configured on this server yet. Please try again later.";
  if (/No AI capacity/i.test(m)) return "The free AI models are very busy right now. Please try again in a little while — your other decks are safe.";
  return "Something went wrong while making this deck. Please try again — it usually works on the next attempt.";
}

/** A deck is still being made (or re-made by an edit) when a queued/running job on this server points at it. */
export function deckBuilding(deckId: string): boolean {
  for (const j of S.jobs.values()) if (j.deckId === deckId && (j.status === "running" || j.status === "queued")) return true;
  return false;
}

export const STILL_BUILDING_MESSAGE = "This deck is still being built — the download opens as soon as it is finished.";

export function exportPath(deckId: string, format: "pdf" | "pptx" | "notes") {
  if (format === "notes") return path.join(deckDir(deckId), "exports", "notes.pdf");
  return path.join(deckDir(deckId), "exports", `deck.${format}`);
}

/** decks whose slides carry {{P1}} presenter placeholders until export ("v4" = decks saved before that engine was retired) */
const TEMPLATE_ENGINES = new Set(["v4", "v5", "v6"]);

export async function buildExports(deckId: string) {
  const deck = loadDeck(deckId);
  if (!deck) throw new Error("deck missing after generation");
  fs.mkdirSync(path.join(deckDir(deckId), "exports"), { recursive: true });
  // template engines (and decks saved by the retired v4): hard final gate — real presenter details, empty detail rows removed, no "{{" in any exported slide
  const gated = TEMPLATE_ENGINES.has(String((deck as any).engine));
  if (gated) {
    const fixed = finalizePlaceholders(deck);
    if (fixed.length) {
      console.log(`[export] deck ${deckId}: placeholder gate fixed ${fixed.join("; ")}`);
      saveDeck(deck);
    }
  }
  // LOW_MEMORY (512 MB hosts): PDF then PPTX one after the other instead of both at once
  const lowMem = process.env.LOW_MEMORY === "true";
  const [pdf, pptx] = lowMem ? [await exportPdf(deck), await exportPptx(deck)] : await Promise.all([exportPdf(deck), exportPptx(deck)]);
  if (gated) await assertNoPlaceholdersInPptx(pptx, deckId);
  fs.writeFileSync(exportPath(deckId, "pdf"), pdf);
  fs.writeFileSync(exportPath(deckId, "pptx"), pptx);
  await buildPreviews(deckId);
  fs.writeFileSync(exportPath(deckId, "notes"), await exportNotesPdf(deck)); // uses the previews as thumbnails
}

/** Slide preview images (what the website shows; light JPEGs, exactly as rendered). */
export async function buildPreviews(deckId: string) {
  const deck = loadDeck(deckId);
  if (!deck) return;
  const tmp = path.join(deckDir(deckId), "render", "png");
  const pngs = await renderPngs(deck, tmp, 1);
  const out = path.join(deckDir(deckId), "previews");
  fs.mkdirSync(out, { recursive: true });
  for (const f of pngs) {
    const n = Number(path.basename(f).match(/(\d+)/)?.[1]);
    await sharp(f).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(out, `slide-${String(n).padStart(2, "0")}.jpg`));
  }
}

export function previewPath(deckId: string, n: number) {
  return path.join(deckDir(deckId), "previews", `slide-${String(n).padStart(2, "0")}.jpg`);
}

function pump() {
  while (S.running.size < MAX_CONCURRENT) {
    const next = startOrder()[0];
    if (!next) break;
    next.status = "running"; // claim before the async start
    S.lastServed.set(next.ownerKey, Date.now());
    run(next);
  }
  // keep the instance awake while any deck is queued or running (Render free sleeps after 15 idle min)
  setActiveJobs(Math.max(S.jobs.size, S.running.size));
}

// ── boot / recovery ───────────────────────────────────────────────────────────
function ready(): Promise<void> {
  if (!S.ready)
    S.ready = (async () => {
      try {
        const st = storage();
        for (const j of await st.recentFinished(20)) if (j.startedAt && j.finishedAt) S.durations.unshift((Date.parse(j.finishedAt) - Date.parse(j.startedAt)) / 1000);
        for (const j of await st.unfinishedJobs()) {
          if (S.jobs.has(j.id)) continue;
          if (j.attempt >= MAX_ATTEMPTS) {
            j.status = "failed";
            j.error = "The server restarted several times while making this deck. Please try again.";
            j.finishedAt = new Date().toISOString();
            await st.saveJob(j);
            continue;
          }
          j.status = "queued";
          j.progress = { stage: "queued", step: "Waiting to resume after a server restart", percent: 0, log: j.progress?.log || [] };
          S.jobs.set(j.id, j);
          await st.saveJob(j);
        }
      } catch (e) {
        console.error("[jobs] recovery failed", e);
      }
      pump();
    })();
  return S.ready;
}

/** Called from instrumentation at server start. */
export function bootJobs() {
  ready().catch(() => {});
}

// ── public API ────────────────────────────────────────────────────────────────
export async function createJob(request: V3Request, ownerKey: string, userId?: string, extra: Partial<Pick<JobRecord, "routes" | "visionMode" | "kind" | "edit">> = {}): Promise<JobView> {
  await ready();
  const mine = [...S.jobs.values()].filter((j) => j.ownerKey === ownerKey).length;
  if (mine >= MAX_QUEUED_PER_OWNER && extra.kind !== "benchmark" && extra.kind !== "edit") throw new QueueFullError(`You already have ${mine} decks in progress. Please wait for one to finish.`);
  const job: JobRecord = {
    id: newJobId(),
    ownerKey,
    userId,
    status: "queued",
    request,
    progress: { stage: "queued", step: "Waiting in line", percent: 0, log: [] },
    attempt: 0,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  S.jobs.set(job.id, job);
  await persist(job, true);
  pump();
  return viewOf(job);
}

export async function getJobView(id: string): Promise<JobView | null> {
  await ready();
  const live = S.jobs.get(id);
  if (live) return viewOf(live);
  const j = await storage().getJob(id);
  return j ? viewOf(j) : null;
}

export async function getJobViews(ids: string[]): Promise<JobView[]> {
  await ready();
  const live = ids.map((id) => S.jobs.get(id)).filter((j): j is JobRecord => !!j);
  const rest = ids.filter((id) => !S.jobs.has(id));
  const stored = rest.length ? await storage().getJobs(rest) : [];
  return [...live, ...stored].map(viewOf).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** getJobView for one caller: null (→ 404) when the job belongs to another account. */
export async function getJobViewFor(id: string, viewerKey: string | Promise<string>, hasStreamToken = false): Promise<JobView | null> {
  // the login check and the job lookup run at the same time (a wrong link answers "not found" sooner)
  const [j, viewer] = await Promise.all([ready().then(() => S.jobs.get(id) || storage().getJob(id)), viewerKey]);
  if (!j || !canSeeJob(j, viewer, hasStreamToken)) return null;
  return viewOf(j);
}

/**
 * Delete a deck for good (job record + deck files), for its owner only. A deck still being made cannot be
 * deleted yet. Returns "ok" | "not_found" | "busy".
 */
export async function deleteJobFor(id: string, ownerKey: string): Promise<"ok" | "not_found" | "busy"> {
  await ready();
  const j = S.jobs.get(id) || (await storage().getJob(id));
  if (!j || j.kind === "benchmark") return "not_found";
  const isOwner = j.userId ? ownerKey === `u:${j.userId}` : j.ownerKey === ownerKey;
  if (!isOwner) return "not_found";
  if (j.status === "queued" || j.status === "running" || S.running.has(id)) return "busy";
  if (j.deckId && j.kind !== "edit") {
    // (an edit job points at its parent deck: deleting the edit record must not delete the deck)
    await storage().deleteDeck(j.deckId);
    try {
      fs.rmSync(deckDir(j.deckId), { recursive: true, force: true });
    } catch {}
  }
  await storage().deleteJob(id);
  S.jobs.delete(id);
  return "ok";
}

/** getJobViews for one caller: jobs of other accounts are left out. */
export async function getJobViewsFor(ids: string[], viewerKey: string): Promise<JobView[]> {
  await ready();
  const live = ids.map((id) => S.jobs.get(id)).filter((j): j is JobRecord => !!j);
  const rest = ids.filter((id) => !S.jobs.has(id));
  const stored = rest.length ? await storage().getJobs(rest) : [];
  return [...live, ...stored]
    .filter((j) => canSeeJob(j, viewerKey))
    .map(viewOf)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function jobsOfOwner(ownerKey: string, limit = 30): Promise<JobView[]> {
  await ready();
  const stored = await storage().jobsByOwner(ownerKey, limit);
  return stored.map((j) => viewOf(S.jobs.get(j.id) || j));
}

export async function queueStats() {
  await ready();
  return { running: S.running.size, queued: [...S.jobs.values()].filter((j) => j.status === "queued").length, maxConcurrent: MAX_CONCURRENT, avgDeckSeconds: Math.round(avgDeckSeconds()) };
}

/** Deck files may live only in durable storage (after a redeploy) — fetch them back. */
export async function ensureDeckLocal(deckId: string): Promise<boolean> {
  return storage().restoreDeck(deckId, deckDir(deckId));
}
