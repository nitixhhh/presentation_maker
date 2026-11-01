/**
 * Engine v4 — orchestrator ("parent + swarm").
 * Brief → Research (v3) → PLANNER agent (tools, exact slide count, one brief per slide) → images + art direction (v3)
 * → DESIGNER agents, 2 in parallel under the shared rate limiter, each slide shown to the user the moment it is
 * submitted → the v3 polish passes on every slide (DOM/geometry QA, vision review, AI revisions, mechanical fixes)
 * → the planner REVIEWS the whole deck (one contact sheet) and sends targeted revisions → Deck.
 * Exports (PDF / PPTX) are the v3 exporters, run by the job manager after this returns.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { runBrief } from "../engine-v3/agents/brief";
import { runResearch } from "../engine-v3/agents/research";
import { runArtDirector } from "../engine-v3/agents/artDirector";
import { designSlide, designerSystemPrompt, reviseSlide, type DesignOut } from "../engine-v3/agents/designer";
import { runImageDirector } from "../engine-v3/agents/imageDirector";
import { deepenResearch } from "./deepen";
import { addLogoAsset, logoSlides } from "../engine-v3/assets/logo";
import { sourceImages } from "../engine-v3/assets/images";
import { inspectSlide, LAYOUT_TYPES, GEOMETRY_TYPES, type Inspection } from "../engine-v3/qa/inspect";
import { visionReview, type VisionVerdict } from "../engine-v3/qa/vision";
import { formatReference } from "../engine-v3/research/sources";
import { referencesSlideHtml } from "../engine-v3/agents/referencesSlide";
import { fallbackSlideHtml } from "../engine-v3/agents/fallbackSlide";
import { assetDir, deckDir, newDeckId, saveDeck } from "../engine-v3/store";
import { availableProviders, chatJson, llmContext, usageSummary, usageLine, sleep } from "../engine-v3/llm";
import { maskText } from "../engine-v3/privacy";
import type { Asset, Deck, OutlineSlide, ProgressFn, SlideDesign, V3Request } from "../engine-v3/types";
import { runPlanner } from "./planner";
import { runDesignerAgent, type AgentResult, type SlideBrief } from "./designerAgent";
import { collapseIcons } from "./iconRender";

export type LiveState = "waiting" | "building" | "ready" | "polishing" | "done";
export interface LiveSlideEvent {
  n: number;
  state: LiveState;
  title?: string;
  status?: string;
  /** a new preview JPEG was written for this slide */
  preview?: boolean;
}

export interface V4Options {
  onProgress?: ProgressFn;
  onDeckId?: (id: string) => void;
  /** live slide-by-slide UI: plan known, slide status text, slide ready (preview written) */
  onPlan?: (slides: { n: number; title: string; role: string; layout: string }[]) => void;
  onSlide?: (e: LiveSlideEvent) => void;
  maxRevisions?: number;
  visionMode?: "smart" | "always" | "off";
}

export function previewFile(deckId: string, n: number) {
  return path.join(deckDir(deckId), "previews", `slide-${String(n).padStart(2, "0")}.jpg`);
}

async function writePreview(deckId: string, n: number, shot: Buffer) {
  const f = previewFile(deckId, n);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  await sharp(shot).jpeg({ quality: 82, mozjpeg: true }).toFile(f);
}

export async function generateDeckV4(req: V3Request, opts: V4Options = {}): Promise<Deck> {
  const outer = llmContext.getStore();
  if (!outer?.stats) return llmContext.run({ ...(outer || {}), stats: [] }, () => generateDeckV4(req, opts));
  const t0 = Date.now();
  const id = newDeckId();
  opts.onDeckId?.(id);
  const log: Deck["log"] = [];
  const emit = (step: string, percent: number, agent: string, action: string, details?: string) => {
    log.push({ t: new Date().toISOString(), agent, msg: action });
    opts.onProgress?.({ step, percent, details, log: { agent, action, timestamp: new Date().toLocaleTimeString() } });
  };
  const slideEvt = (e: LiveSlideEvent) => {
    try {
      opts.onSlide?.(e);
    } catch {}
  };
  const maxRevisions = opts.maxRevisions ?? Number(process.env.V3_MAX_REVISIONS ?? 2);
  const visionMode = opts.visionMode || (process.env.V3_VISION_QA || "smart").toLowerCase();
  const timings: Record<string, number> = {};
  const mark = (k: string, from: number) => (timings[k] = Math.round((Date.now() - from) / 1000));

  emit("Understanding your brief", 3, "Brief", `Engine v4 (planner + designer agents). Providers ready: ${availableProviders().join(", ") || "none"}`);
  let tt = Date.now();
  const brief = await runBrief(req);
  emit("Understanding your brief", 8, "Brief", `${brief.deckType} · ${brief.level} · ${brief.slideCount} slides · ${brief.language}`, brief.requiredSections.join(" → "));
  mark("brief", tt);

  tt = Date.now();
  emit("Researching real sources", 10, "Research", `Searching Wikipedia + OpenAlex for: ${brief.researchQueries.join("; ")}`);
  const research = await deepenResearch(brief, await runResearch(brief, (m) => emit("Researching real sources", 14, "Research", m), req.topic), req.topic, (m) => emit("Researching real sources", 18, "Research", m));
  emit("Researching real sources", 20, "Research", `${research.facts.length} cited facts from ${research.sources.length} sources`);
  mark("research", tt);

  tt = Date.now();
  emit("Planning the story", 22, "Planner", "The planner agent is reading the planning guide and briefing one designer per slide");
  const plan = await runPlanner(brief, research, (m) => emit("Planning the story", 26, "Planner", m));
  const outline = plan.outline;
  const briefs = new Map<number, SlideBrief>(plan.briefs.map((b) => [b.n, b]));
  emit("Planning the story", 30, "Planner", `${outline.slides.length} slides planned (${plan.requests} AI calls${plan.model ? `, ${plan.model}` : ""})${plan.repaired.length ? ` — engine fixes: ${plan.repaired.join("; ")}` : ""}`, outline.slides.map((s) => `${s.n}. ${s.title}`).join(" | "));
  mark("planner", tt);
  opts.onPlan?.(plan.briefs.map((b) => ({ n: b.n, title: b.title, role: b.role, layout: b.layout })));

  // a chart is only allowed when the slide actually has numbers
  for (const s of outline.slides)
    if (s.visual.kind === "chart" && !s.points.some((p) => /\d/.test(p.text))) {
      s.visual.kind = "diagram";
      s.visual.idea = `A diagram (no chart, no numbers) that explains: ${s.keyMessage || s.title}`;
      const b = briefs.get(s.n);
      if (b) b.visual = { ...b.visual, kind: "diagram", diagram: b.visual.diagram && !["bars", "line", "donut", "stacked"].includes(b.visual.diagram) ? b.visual.diagram : "flow" };
    }

  // citations: number sources by first use (same as v3)
  const citeMap = new Map<string, number>();
  const factSrc = new Map(research.facts.map((f) => [f.id, f.sources]));
  for (const s of outline.slides) for (const p of s.points) for (const fid of p.factIds || []) for (const sid of factSrc.get(fid) || []) if (!citeMap.has(sid)) citeMap.set(sid, citeMap.size + 1);
  if (citeMap.size < 3) for (const src of research.sources) if (!citeMap.has(src.id) && citeMap.size < 6) citeMap.set(src.id, citeMap.size + 1);
  const references = Array.from(citeMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([sid, n]) => ({ n, sourceId: sid, text: formatReference(research.sources.find((s) => s.id === sid)!, brief.referenceStyle) }));

  tt = Date.now();
  emit("Designing the look + finding images", 32, "Images", "Sourcing real photos (Wikimedia Commons, NASA, Openverse) for the slides the planner chose");
  const dir = assetDir(id);
  const imagePlan = req.imageMode === "none" ? undefined : await runImageDirector(brief, outline.slides.filter((s) => s.visual.kind === "photo" || s.visual.kind === "generated" || s.role === "title"), req.styleHint).catch(() => undefined);
  const assets = await sourceImages(outline.slides, dir, { mode: req.imageMode || "real-first", topic: brief.title, plan: imagePlan }, (m) => emit("Finding images", 36, "Images", m));
  if (req.logoId) {
    const logo = await addLogoAsset(req.logoId, dir, logoSlides(outline.slides));
    if (logo) {
      assets.push(logo);
      emit("Finding images", 38, "Images", `Institution logo added — on the title${logo.forSlides.length > 1 ? "/closing" : ""} slide, small in the corner on the others`);
    }
  }
  // v4: one vision pass drops photos that do not fit their slide (product/brand shots, charts, text, off-topic)
  if (assets.some((a) => a.origin !== "upload" && a.origin !== "generated")) {
    const dropped = await vetPhotos(assets, outline.slides, dir);
    if (dropped.length) {
      for (const a of dropped) assets.splice(assets.indexOf(a), 1);
      emit("Finding images", 38, "Images", `dropped ${dropped.length} photo(s) that did not fit their slide: ${dropped.map((a) => `slide ${a.forSlides.join(",")}`).join("; ")}`);
    }
  }
  const design = await runArtDirector(brief, outline, assets.filter((a) => a.origin !== "upload"));
  emit("Designing the look + finding images", 40, "ArtDirector", `${design.name}: ${design.font.heading}/${design.font.body}, motif — ${design.motif}`);
  mark("images+art", tt);

  const deck: Deck = { id, createdAt: new Date().toISOString(), request: req, brief, research, outline, design, assets, slides: [], references, log };
  (deck as any).engine = "v4";
  saveDeck(deck);

  const referenceTexts = references.map((r) => r.text);
  const missingReferences = (html: string) => {
    const flat = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    return referenceTexts.filter((t) => !flat.includes(t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").slice(0, 40)));
  };
  const checkReferences = (insp: Inspection) => {
    const missing = missingReferences(insp.html);
    if (missing.length) insp.issues.push({ type: "references-missing", severity: "high", detail: `${missing.length} reference(s) missing or altered — every reference must appear exactly as given, e.g. "${missing[0].slice(0, 80)}"` });
  };
  const renderDir = path.join(deckDir(id), "render");
  const total = outline.slides.length;
  const slides = new Map<number, SlideDesign>();
  const agentStats: { n: number; requests: number; turns: number; checks: number; submitted: boolean; fallback?: string; seconds: number; model?: string; icons: number; note?: string }[] = [];
  let done = 0;
  const saveSlides = () => {
    deck.slides = Array.from(slides.values()).sort((a, b) => a.n - b.n);
    saveDeck(deck);
  };

  /** the v3 polish passes for one slide, starting from the agent's submitted design */
  async function polish(os: OutlineSlide, d: DesignOut, agent: AgentResult | null): Promise<SlideDesign> {
    const isRefs = os.role === "references";
    const allowed = [os.title, os.keyMessage, ...os.points.map((x) => x.text), ...os.points.flatMap((x) => (x.factIds || []).map((fid) => research.facts.find((f) => f.id === fid)?.text || "")), ...brief.titleSlideFields.map((f) => f.value), brief.title, String(new Date().getFullYear())].join(" ");
    type Rec = { d: DesignOut; insp: Inspection; vision: VisionVerdict | null; rank: number };
    let best: Rec | null = null;
    let revisions = 0;
    let redesigned = false;
    for (let round = 0; round <= maxRevisions; round++) {
      const insp = await inspectSlide(deck, os.n, d.html, renderDir, os.role, allowed);
      if (isRefs) checkReferences(insp);
      const high = insp.issues.filter((x) => x.severity === "high").length;
      const med = insp.issues.filter((x) => x.severity === "medium").length;
      const wantVision = visionMode === "always" || (visionMode === "smart" && (round === 0 || high + med > 0));
      const vision = wantVision ? await visionReview(insp.screenshot, os, insp.issues, brief.title) : null;
      const score = vision?.score ?? (high ? 4 : med ? 6 : 7.5);
      const rank = score - 2 * high - 0.5 * med;
      const rec: Rec = { d: { ...d, html: insp.html }, insp, vision, rank };
      if (!best || rank > best.rank) best = rec;
      const needFix = high > 0 || !!vision?.fix || insp.issues.some((x) => GEOMETRY_TYPES.has(x.type));
      emit("Visual QA", 60 + Math.round((done / total) * 25), `QA ${os.n}`, `round ${round + 1}: ${vision ? `score ${vision.score}/10, ` : wantVision ? "" : "clean render, "}${high} serious + ${med} minor issues${insp.autoFixes.length ? `, auto-fit ${insp.autoFixes.length}` : ""}`);
      if (!needFix) break;
      slideEvt({ n: os.n, state: "polishing", status: high ? "Polishing: fixing a layout problem…" : "Polishing details…" });
      if (round === maxRevisions) {
        if (!redesigned && high > 0) {
          redesigned = true;
          try {
            const d2 = await designSlide(deck, os, citeMap, 1, [], "IMPORTANT: an earlier design of this slide kept breaking (text cut off or overlapping). Choose a simpler, more robust composition with fewer elements and more space, still distinctive." + (briefs.get(os.n)?.designerBrief ? ` PLANNER'S NOTE: ${briefs.get(os.n)!.designerBrief}` : ""), "revision");
            const insp2 = await inspectSlide(deck, os.n, d2.html, renderDir, os.role, allowed);
            if (isRefs) checkReferences(insp2);
            const h2 = insp2.issues.filter((x) => x.severity === "high").length;
            const m2 = insp2.issues.filter((x) => x.severity === "medium").length;
            const r2 = (h2 ? 4 : m2 ? 6 : 7.5) - 2 * h2 - 0.5 * m2;
            if (r2 > best.rank) best = { d: { ...d2, html: insp2.html }, insp: insp2, vision: null, rank: r2 };
            emit("Visual QA", 88, `QA ${os.n}`, `fresh redesign: ${h2} serious + ${m2} minor issues`);
          } catch (e: any) {
            emit("Visual QA", 88, `QA ${os.n}`, `redesign unavailable: ${String(e.message).slice(0, 100)}`);
          }
        }
        break;
      }
      const feedback = [...insp.issues.map((x) => `- [${x.severity}] ${x.detail}`), ...(vision?.issues || []).map((x) => `- ${x}`)].join("\n");
      try {
        d = await reviseSlide({ ...d, html: collapseIcons(insp.html) }, feedback, brief.titleSlideFields);
        revisions++;
      } catch (e: any) {
        emit("Visual QA", 62, `QA ${os.n}`, `revision unavailable: ${String(e.message).slice(0, 100)}`);
        break;
      }
    }
    const CONTRAST = new Set(["low-contrast", "busy-background"]);
    const mechanical = (xs: { type: string; severity: string }[]) => xs.filter((x) => (LAYOUT_TYPES.has(x.type) && x.severity === "high") || CONTRAST.has(x.type)).length;
    if (best && mechanical(best.insp.issues) > 0) {
      const before = mechanical(best.insp.issues);
      try {
        const fixed = await inspectSlide(deck, os.n, best.d.html, renderDir, os.role, allowed, { enforce: true, fixContrast: true });
        if (isRefs) checkReferences(fixed);
        const after = mechanical(fixed.issues);
        if (after < before) best = { ...best, d: { ...best.d, html: fixed.html }, insp: fixed };
        emit("Visual QA", 88, `QA ${os.n}`, `layout/contrast auto-fix: ${before} → ${Math.min(before, after)} problems${fixed.autoFixes.length ? ` (${fixed.autoFixes.slice(0, 4).join(", ")})` : ""}`);
      } catch (e: any) {
        emit("Visual QA", 88, `QA ${os.n}`, `layout auto-fix unavailable: ${String(e?.message || e).slice(0, 100)}`);
      }
    }
    if (isRefs && best && (best.insp.issues.some((x) => x.type === "references-missing") || missingReferences(best.d.html).length)) {
      const html = referencesSlideHtml(deck, os.title || "References");
      const insp = await inspectSlide(deck, os.n, html, renderDir, "references");
      best = { d: { ...best.d, html: insp.html, provider: "engine", model: "references" }, insp, vision: null, rank: 6 };
      emit("Visual QA", 88, `QA ${os.n}`, "references slide: used the exact reference list");
    }
    const b = best!;
    await writePreview(id, os.n, b.insp.screenshot);
    return {
      n: os.n,
      html: b.d.html,
      notes: b.d.notes,
      provider: b.d.provider,
      model: b.d.model,
      revisions,
      qa: { domIssues: b.insp.issues, visionScore: b.vision?.score, visionIssues: b.vision?.issues, autoFixes: b.insp.autoFixes },
    };
  }

  const polishing: Promise<void>[] = [];
  const polishSlots = limiter(Math.max(1, Number(process.env.V4_POLISHERS || 2)));
  async function buildSlide(os: OutlineSlide): Promise<void> {
    const ts = Date.now();
    const b = briefs.get(os.n)!;
    slideEvt({ n: os.n, state: "building", status: "Reading the slide brief…" });
    let agent: AgentResult | null = null;
    let d: DesignOut | null = null;
    try {
      agent = await runDesignerAgent({
        deck,
        os,
        brief: b,
        citeMap,
        allowedText: [os.title, os.keyMessage, ...os.points.map((x) => x.text), ...brief.titleSlideFields.map((f) => f.value), brief.title, String(new Date().getFullYear())].join(" "),
        renderDir,
        status: (text) => slideEvt({ n: os.n, state: "building", status: text }),
      });
      d = agent;
      emit("Designing slides", 42 + Math.round((done / total) * 35), `Designer ${os.n}`, `${agent.submitted ? "submitted" : agent.fallback === "v3-designer" ? "classic designer" : "best checked version"} "${os.title}" — ${agent.requests} AI calls, ${agent.turns} turns, ${agent.checks} checks, ${agent.iconsUsed.length} icons${agent.note ? ` — note: ${agent.note}` : ""}`);
    } catch (e: any) {
      emit("Designing slides", 50, `Designer ${os.n}`, `designer agent failed (${String(e?.message || e).slice(0, 80)}) — classic designer`);
      try {
        d = await designSlide(deck, os, citeMap, 0, [], b.designerBrief ? `PLANNER'S NOTE: ${b.designerBrief}` : "");
      } catch {
        await sleep(15_000);
        try {
          d = await designSlide(deck, os, citeMap, 1, [], "Choose a clear, robust composition with fewer elements and generous space, still distinctive and on-brand.");
        } catch {
          const html = os.role === "references" ? referencesSlideHtml(deck, os.title || "References") : fallbackSlideHtml(deck, os, citeMap);
          d = { html, notes: os.notes || "", provider: "engine", model: "fallback", messages: [] };
          emit("Designing slides", 50, `Designer ${os.n}`, "used a calm backup layout (no AI designer was available for this slide)");
        }
      }
    }
    // show the submitted slide at once (its last check render when it is the same HTML)
    try {
      const shot = agent?.lastInspection && agent.submitted ? agent.lastInspection.screenshot : (await inspectSlide(deck, os.n, d!.html, renderDir, os.role)).screenshot;
      await writePreview(id, os.n, shot);
      slides.set(os.n, { n: os.n, html: d!.html, notes: d!.notes, provider: d!.provider, model: d!.model, revisions: 0 });
      saveSlides();
      slideEvt({ n: os.n, state: "ready", status: "Ready — polishing in the background", preview: true });
    } catch {}
    // the v3 polish passes (never skipped) run beside the next designers, so a slot is free for the next slide at once
    const designSeconds = Math.round((Date.now() - ts) / 1000);
    polishing.push(
      polishSlots(async () => {
        try {
          const final = await polish(os, d!, agent);
          slides.set(os.n, final);
        } catch (e: any) {
          console.error(`[v4] slide ${os.n} polish failed — keeping the draft`, e);
          emit("Visual QA", 88, `QA ${os.n}`, `could not finish the checks (${String(e?.message || e).slice(0, 80)}) — kept the draft`);
        }
        done++;
        saveSlides();
        slideEvt({ n: os.n, state: "done", status: "Done", preview: true });
        agentStats.push({ n: os.n, requests: agent?.requests ?? 1, turns: agent?.turns ?? 0, checks: agent?.checks ?? 0, submitted: !!agent?.submitted, fallback: agent?.fallback, seconds: designSeconds, model: agent?.model, icons: agent?.iconsUsed.length ?? 0, note: agent?.note });
      })
    );
  }

  // designers: slide 1 first, then the rest — V4_DESIGNERS at once (the scheduler's per-provider limits throttle further)
  tt = Date.now();
  emit("Designing slides", 42, "Designers", `${total} designer agents, ${Math.max(1, Number(process.env.V4_DESIGNERS || 2))} at a time`);
  const queue = outline.slides.slice();
  const parallel = Math.max(1, Math.min(4, Number(process.env.V4_DESIGNERS || 2)));
  await Promise.all(
    Array.from({ length: Math.min(parallel, queue.length) }, async () => {
      for (;;) {
        const os = queue.shift();
        if (!os) return;
        try {
          await buildSlide(os);
        } catch (e) {
          console.error(`[v4] slide ${os.n} failed`, e);
        }
      }
    })
  );
  await Promise.all(polishing);
  mark("designers+polish", tt);
  // any slide that never landed gets the calm backup layout so the deck is complete
  for (const os of outline.slides)
    if (!slides.has(os.n)) {
      const html = os.role === "references" ? referencesSlideHtml(deck, os.title || "References") : fallbackSlideHtml(deck, os, citeMap);
      slides.set(os.n, { n: os.n, html, notes: os.notes || "", provider: "engine", model: "fallback", revisions: 0 });
    }
  saveSlides();

  // ── parent review: the planner looks at the whole deck once and asks for targeted revisions ──────────────
  tt = Date.now();
  try {
    await reviewDeck(deck, emit, slideEvt, renderDir);
  } catch (e: any) {
    emit("Final review", 92, "Planner", `deck review skipped: ${String(e?.message || e).slice(0, 100)}`);
  }
  mark("review", tt);
  saveSlides();

  const ctxStats = llmContext.getStore()?.stats;
  if (ctxStats) {
    deck.calls = ctxStats.slice();
    deck.usage = usageSummary(deck.calls);
    console.log(`[v4/usage] deck ${deck.id}: ${usageLine(deck.usage)}`);
    emit("Done", 99, "Owner", `AI usage: ${usageLine(deck.usage)}`);
  }
  (deck as any).v4 = { timings, planner: { requests: plan.requests, model: plan.model, repaired: plan.repaired }, agents: agentStats.sort((a, b) => a.n - b.n) };
  const scored = deck.slides.filter((x) => x.qa?.visionScore);
  const avg = scored.length ? scored.reduce((s, x) => s + (x.qa?.visionScore || 0), 0) / scored.length : 0;
  const clean = deck.slides.filter((x) => !(x.qa?.domIssues || []).some((i) => i.severity !== "low")).length;
  emit("Done", 100, "Owner", `Deck ready in ${Math.round((Date.now() - t0) / 1000)}s · ${clean}/${deck.slides.length} slides render cleanly${scored.length ? ` · vision score ${avg.toFixed(1)}/10 on ${scored.length} checked` : ""}`);
  saveDeck(deck);
  return deck;
}

/** One contact sheet of every slide → the planner (a vision model) → up to 3 targeted revisions. */
async function reviewDeck(deck: Deck, emit: (step: string, percent: number, agent: string, action: string) => void, slideEvt: (e: LiveSlideEvent) => void, renderDir: string) {
  const files = deck.slides.map((s) => previewFile(deck.id, s.n)).filter((f) => fs.existsSync(f));
  if (files.length < 3) return;
  const cols = 4, tw = 400, th = 225, pad = 8, lab = 22;
  const rows = Math.ceil(files.length / cols);
  const comps: { input: Buffer; left: number; top: number }[] = [];
  const texts: string[] = [];
  for (let i = 0; i < deck.slides.length; i++) {
    const f = previewFile(deck.id, deck.slides[i].n);
    if (!fs.existsSync(f)) continue;
    const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + lab + pad);
    comps.push({ input: await sharp(f).resize(tw, th).jpeg({ quality: 70 }).toBuffer(), left: x, top: y + lab });
    texts.push(`<text x="${x + 2}" y="${y + 16}" font-size="15" font-family="sans-serif" font-weight="bold">${deck.slides[i].n}</text>`);
  }
  const W = pad + cols * (tw + pad), H = pad + rows * (th + lab + pad);
  const sheet = await sharp({ create: { width: W, height: H, channels: 3, background: "#e5e7eb" } })
    .composite([...comps, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${texts.join("")}</svg>`), left: 0, top: 0 }])
    .jpeg({ quality: 72 })
    .toBuffer();
  fs.writeFileSync(path.join(deckDir(deck.id), "render", "review-sheet.jpg"), sheet);
  emit("Final review", 90, "Planner", "The planner is reviewing the whole deck (consistency, repeated layouts, story)");
  const fields = deck.brief.titleSlideFields || [];
  const list = deck.outline.slides.map((s) => `${s.n}. [${s.role}] ${maskText(s.title, fields)}`).join("\n");
  const prompt = `You are the planner of this ${deck.slides.length}-slide deck "${deck.brief.title}". The image is a contact sheet of every finished slide (numbered).
Slides:
${list}
Review the WHOLE deck like a design lead: consistency (title position/size, colours, icon style), repeated compositions on neighbouring slides, a slide that looks broken/empty/crammed, text that is hard to read, a weak visual, story order.
Ask for at most 3 targeted revisions (only real problems; none is fine). Each instruction must be concrete and doable in HTML/CSS (e.g. "move the title to the same top-left position as the other slides", "replace the plain cards with an icon per card").
Reply ONLY JSON: {"overall": "one sentence", "revisions": [{"n": 3, "instruction": "..."}]}`;
  const { data } = await chatJson<any>("planner", [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${sheet.toString("base64")}` } }] }], { temperature: 0.2, maxTokens: 2000, timeoutMs: 150_000, label: "v4 deck review" });
  const revs = (Array.isArray(data?.revisions) ? data.revisions : []).filter((r: any) => Number.isInteger(Number(r?.n)) && r?.instruction).slice(0, 3);
  (deck as any).review = { overall: String(data?.overall || "").slice(0, 300), revisions: revs };
  emit("Final review", 91, "Planner", `${String(data?.overall || "reviewed").slice(0, 160)}${revs.length ? ` — revising slides ${revs.map((r: any) => r.n).join(", ")}` : " — no changes needed"}`);
  for (const r of revs) {
    const s = deck.slides.find((x) => x.n === Number(r.n));
    const os = deck.outline.slides.find((x) => x.n === Number(r.n));
    if (!s || !os || os.role === "references") continue;
    slideEvt({ n: s.n, state: "polishing", status: "Final review: adjusting…" });
    try {
      const before = await inspectSlide(deck, s.n, s.html, renderDir, os.role);
      const bh = before.issues.filter((i) => i.severity === "high").length;
      const prev: DesignOut = { html: collapseIcons(s.html), notes: s.notes, provider: s.provider || "", model: s.model || "", messages: [{ role: "system", content: designerSystemPrompt(deck.design, deck.brief) + `\n\nICONS: the slide uses real icons written as <i class="ic" data-icon="ID"></i> placeholders (the engine draws them). Keep them; you may move/resize/recolour them with CSS.` }, { role: "user", content: `Slide ${s.n} of ${deck.slides.length} — role ${os.role}. TITLE: ${maskText(os.title, fields)}. KEY MESSAGE: ${maskText(os.keyMessage || "-", fields)}` }] };
      const d = await reviseSlide(prev, `- [deck review] ${String(r.instruction).slice(0, 400)}`, fields);
      const after = await inspectSlide(deck, s.n, d.html, renderDir, os.role);
      const ah = after.issues.filter((i) => i.severity === "high").length;
      if (ah <= bh) {
        s.html = after.html;
        s.revisions = (s.revisions || 0) + 1;
        await writePreview(deck.id, s.n, after.screenshot);
        emit("Final review", 92, `Review ${s.n}`, `revised: ${String(r.instruction).slice(0, 100)}`);
      } else emit("Final review", 92, `Review ${s.n}`, `revision made it worse (${ah} vs ${bh} serious issues) — kept the original`);
    } catch (e: any) {
      emit("Final review", 92, `Review ${s.n}`, `revision unavailable: ${String(e?.message || e).slice(0, 80)}`);
    }
    slideEvt({ n: s.n, state: "done", status: "Done", preview: true });
  }
}

/** vision check of the sourced photos against their slides; returns the assets to drop */
async function vetPhotos(assets: Asset[], slides: OutlineSlide[], dir: string): Promise<Asset[]> {
  const list = assets.filter((a) => a.origin !== "upload" && a.origin !== "generated").slice(0, 8);
  if (!list.length) return [];
  try {
    const tw = 360, th = 240, lab = 26;
    const tiles = await Promise.all(list.map(async (a, i) => ({ input: await sharp(path.join(dir, a.file)).resize(tw, th, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer(), left: (i % 4) * (tw + 10), top: Math.floor(i / 4) * (th + lab + 10) + lab })));
    const W = Math.min(4, list.length) * (tw + 10), H = Math.ceil(list.length / 4) * (th + lab + 10);
    const labels = list.map((_, i) => `<text x="${(i % 4) * (tw + 10) + 4}" y="${Math.floor(i / 4) * (th + lab + 10) + 20}" font-size="20" font-family="sans-serif" font-weight="bold">${i + 1}</text>`).join("");
    const sheet = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite([...tiles, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels}</svg>`), left: 0, top: 0 }]).jpeg({ quality: 75 }).toBuffer();
    const lines = list.map((a, i) => {
      const s = slides.find((x) => a.forSlides.includes(x.n));
      return `${i + 1}. slide "${s?.title || "?"}" — ${(s?.points || []).map((p) => p.text).join("; ").slice(0, 160)}`;
    });
    const { data } = await chatJson<any>("agent", [{ role: "user", content: [{ type: "text", text: `Each numbered picture was chosen for the slide listed below it. Reject a picture when it does NOT clearly show the slide's subject, or when it is a commercial product / brand / logo shot, a chart, graph, map or diagram with text, a screenshot, a scanned page, or has big text or a watermark. Keep good, relevant photos.\n${lines.join("\n")}\nReply ONLY JSON: {"reject":[numbers]}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${sheet.toString("base64")}` } }] }], { temperature: 0, maxTokens: 300, timeoutMs: 90_000, label: "v4 photo vet" });
    const rej: number[] = (Array.isArray(data?.reject) ? data.reject : []).map(Number).filter((x: number) => Number.isInteger(x) && x >= 1 && x <= list.length);
    return rej.map((x) => list[x - 1]);
  } catch {
    return [];
  }
}

/** tiny concurrency limiter */
function limiter(n: number) {
  let active = 0;
  const q: (() => void)[] = [];
  return async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (active >= n) await new Promise<void>((r) => q.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      q.shift()?.();
    }
  };
}
