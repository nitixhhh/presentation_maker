/**
 * Engine v3 — orchestrator.
 * Brief → Research → Outline → (Design system ∥ Images) → Designers in parallel → Visual QA loop → Deck
 * Exports (PDF / PPTX) are produced on demand from the stored deck (export/pdf.ts, export/pptx.ts).
 */
import fs from "fs";
import path from "path";
import { runBrief } from "./agents/brief";
import { runResearch } from "./agents/research";
import { runOutline } from "./agents/outline";
import { runArtDirector } from "./agents/artDirector";
import { designSlide, reviseSlide, type DesignOut } from "./agents/designer";
import { pickRecipes } from "./design/pickRecipes";
import { runImageDirector } from "./agents/imageDirector";
import { addLogoAsset } from "./assets/logo";
import { sourceImages } from "./assets/images";
import { inspectSlide, type Inspection } from "./qa/inspect";
import { visionReview, type VisionVerdict } from "./qa/vision";
import { formatReference } from "./research/sources";
import { referencesSlideHtml } from "./agents/referencesSlide";
import { assetDir, deckDir, newDeckId, saveDeck } from "./store";
import { availableProviders, llmContext, usageSummary, usageLine } from "./llm";
import type { Deck, ProgressFn, SlideDesign, V3Request } from "./types";

export interface PipelineOptions {
  onProgress?: ProgressFn;
  maxRevisions?: number; // per slide, default 2
  vision?: boolean; // default true
  onDeckId?: (id: string) => void; // called as soon as the deck id exists
  visionMode?: "smart" | "always" | "off";
}

export async function generateDeckV3(req: V3Request, opts: PipelineOptions = {}): Promise<Deck> {
  // always collect per-call stats (job runs already have a context; CLI / scripts get one here)
  const outer = llmContext.getStore();
  if (!outer?.stats) return llmContext.run({ ...(outer || {}), stats: [] }, () => generateDeckV3(req, opts));
  const t0 = Date.now();
  const id = newDeckId();
  opts.onDeckId?.(id);
  const log: Deck["log"] = [];
  const emit = (step: string, percent: number, agent: string, action: string, details?: string) => {
    const entry = { t: new Date().toISOString(), agent, msg: action };
    log.push(entry);
    opts.onProgress?.({ step, percent, details, log: { agent, action, timestamp: new Date().toLocaleTimeString() } });
  };
  const maxRevisions = opts.maxRevisions ?? Number(process.env.V3_MAX_REVISIONS ?? 2);
  // Vision QA mode: "smart" (default) = only for slides whose DOM checks found a problem, plus the title slide;
  // "always" = every slide every round; "off" = never. Slides that render cleanly do not spend a vision call.
  const visionMode = opts.visionMode || (opts.vision === false ? "off" : (process.env.V3_VISION_QA || "smart").toLowerCase());

  emit("Understanding your brief", 3, "Brief", `Providers ready: ${availableProviders().join(", ") || "none"}`);
  const brief = await runBrief(req);
  emit("Understanding your brief", 8, "Brief", `${brief.deckType} · ${brief.level} · ${brief.slideCount} slides · ${brief.language}`, brief.requiredSections.join(" → "));

  emit("Researching real sources", 10, "Research", `Searching Wikipedia + OpenAlex for: ${brief.researchQueries.join("; ")}`);
  const research = await runResearch(brief, (m) => emit("Researching real sources", 14, "Research", m), req.topic);
  emit("Researching real sources", 22, "Research", `${research.facts.length} cited facts from ${research.sources.length} sources`);

  emit("Writing the story", 24, "Story", "Planning slide-by-slide narrative");
  const outline = await runOutline(brief, research);
  emit("Writing the story", 32, "Story", outline.slides.map((s) => `${s.n}. ${s.title} [${s.visual.kind}]`).join(" | "));

  // a chart is only allowed when the slide actually has numbers
  for (const s of outline.slides)
    if (s.visual.kind === "chart" && !s.points.some((p) => /\d/.test(p.text))) {
      s.visual.kind = "diagram";
      s.visual.idea = `A diagram (no chart, no numbers) that explains: ${s.keyMessage || s.title}`;
    }

  // citations: number sources by first use
  const citeMap = new Map<string, number>();
  const factSrc = new Map(research.facts.map((f) => [f.id, f.sources]));
  for (const s of outline.slides) for (const p of s.points) for (const fid of p.factIds || []) for (const sid of factSrc.get(fid) || []) if (!citeMap.has(sid)) citeMap.set(sid, citeMap.size + 1);
  if (citeMap.size < 3) for (const src of research.sources) if (!citeMap.has(src.id) && citeMap.size < 6) citeMap.set(src.id, citeMap.size + 1);
  const references = Array.from(citeMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([sid, n]) => ({ n, sourceId: sid, text: formatReference(research.sources.find((s) => s.id === sid)!, brief.referenceStyle) }));

  emit("Designing the look + finding images", 34, "Images", "Sourcing real photos (Wikimedia Commons, Openverse) and picking the best with a vision model");
  const dir = assetDir(id);
  const imagePlan = req.imageMode === "none" ? undefined : await runImageDirector(brief, outline.slides, req.styleHint);
  if (imagePlan) emit("Designing the look + finding images", 37, "ImageDirector", imagePlan.items.filter((x) => x.source !== "none").map((x) => `${x.n}: ${x.source === "real" ? `photo "${x.query}"` : "AI image"}`).join(" | ") || "no images needed");
  const assets = await sourceImages(outline.slides, dir, { mode: req.imageMode || "real-first", topic: brief.title, plan: imagePlan }, (m) => emit("Finding images", 40, "Images", m));
  if (req.logoId) {
    const logo = await addLogoAsset(req.logoId, dir, outline.slides.map((s) => s.n));
    if (logo) {
      assets.push(logo);
      emit("Finding images", 44, "Images", "Institution logo added — the designer decides where it goes");
    }
  }
  const design = await runArtDirector(brief, outline, assets.filter((a) => a.origin !== "upload"));
  emit("Designing the look + finding images", 46, "ArtDirector", `${design.name}: ${design.font.heading}/${design.font.body}, motif — ${design.motif}`);

  const deck: Deck = { id, createdAt: new Date().toISOString(), request: req, brief, research, outline, design, assets, slides: [], references, log };
  saveDeck(deck);

  // Inspiration from the recipe library: 2–3 relevant example slides per slide, varied across the deck.
  const usedRecipes = new Map<string, number>();
  const inspiration = new Map(outline.slides.map((os) => [os.n, pickRecipes(os, assets, usedRecipes, 3)]));
  const referenceTexts = references.map((r) => r.text);

  // Designers in parallel (the provider scheduler throttles), each followed by its own QA loop
  const renderDir = path.join(deckDir(id), "render");
  let done = 0;
  const total = outline.slides.length;
  const slides: SlideDesign[] = await Promise.all(
    outline.slides.map(async (os, i): Promise<SlideDesign> => {
      const isRefs = os.role === "references";
      let d: DesignOut = await designSlide(deck, os, citeMap, i, inspiration.get(os.n));
      emit("Designing slides", 50 + Math.round((done / total) * 30), `Designer ${os.n}`, `drafted "${os.title}"`);
      type Rec = { d: DesignOut; insp: Inspection; vision: VisionVerdict | null; rank: number };
      let best: Rec | null = null;
      let revisions = 0;
      let redesigned = false;
      const allowed = [os.title, os.keyMessage, ...os.points.map((x) => x.text), ...os.points.flatMap((x) => (x.factIds || []).map((id) => research.facts.find((f) => f.id === id)?.text || "")), ...brief.titleSlideFields.map((f) => f.value), brief.title, String(new Date().getFullYear())].join(" ");
      for (let round = 0; round <= maxRevisions; round++) {
        const insp = await inspectSlide(deck, os.n, d.html, renderDir, os.role, allowed);
        // the references slide must carry every reference exactly (mechanical check)
        if (isRefs) {
          const flat = insp.html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
          const missing = referenceTexts.filter((t) => !flat.includes(t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").slice(0, 40)));
          if (missing.length) insp.issues.push({ type: "references-missing", severity: "high", detail: `${missing.length} reference(s) missing or altered — every reference must appear exactly as given, e.g. "${missing[0].slice(0, 80)}"` });
        }
        const high = insp.issues.filter((x) => x.severity === "high").length;
        const med = insp.issues.filter((x) => x.severity === "medium").length;
        const wantVision = visionMode === "always" || (visionMode === "smart" && (high + med > 0 || (os.role === "title" && round === 0)));
        const vision = wantVision && !isRefs ? await visionReview(insp.screenshot, os, insp.issues, brief.title) : null;
        const score = vision?.score ?? (high ? 4 : med ? 6 : 7.5);
        const rank = score - 2 * high - 0.5 * med;
        const rec: Rec = { d: { ...d, html: insp.html }, insp, vision, rank };
        if (!best || rank > best.rank) best = rec;
        const needFix = high > 0 || !!vision?.fix;
        emit("Visual QA", 55 + Math.round((done / total) * 35), `QA ${os.n}`, `round ${round + 1}: ${vision ? `score ${vision.score}/10, ` : wantVision ? "" : "clean render, "}${high} serious + ${med} minor issues${insp.autoFixes.length ? `, auto-fit ${insp.autoFixes.length}` : ""}`);
        if (!needFix) break;
        if (round === maxRevisions) {
          // still broken after its revisions: one fresh redesign by the AI (new composition), never a fixed layout
          if (!redesigned && high > 0) {
            redesigned = true;
            try {
              d = await designSlide(deck, os, citeMap, i + 1, pickRecipes(os, assets, usedRecipes, 2), "IMPORTANT: an earlier design of this slide kept breaking (text cut off or overlapping). Choose a simpler, more robust composition with fewer elements and more space, still distinctive.");
              const insp2 = await inspectSlide(deck, os.n, d.html, renderDir, os.role, allowed);
              const h2 = insp2.issues.filter((x) => x.severity === "high").length;
              const m2 = insp2.issues.filter((x) => x.severity === "medium").length;
              const r2 = (h2 ? 4 : m2 ? 6 : 7.5) - 2 * h2 - 0.5 * m2;
              if (r2 > best.rank) best = { d: { ...d, html: insp2.html }, insp: insp2, vision: null, rank: r2 };
              emit("Visual QA", 90, `QA ${os.n}`, `fresh redesign: ${h2} serious + ${m2} minor issues`);
            } catch (e: any) {
              emit("Visual QA", 90, `QA ${os.n}`, `redesign unavailable: ${String(e.message).slice(0, 100)}`);
            }
          }
          break;
        }
        const feedback = [...insp.issues.map((x) => `- [${x.severity}] ${x.detail}`), ...(vision?.issues || []).map((x) => `- ${x}`)].join("\n");
        try {
          d = await reviseSlide({ ...d, html: insp.html }, feedback);
          revisions++;
        } catch (e: any) {
          emit("Visual QA", 60, `QA ${os.n}`, `revision unavailable: ${String(e.message).slice(0, 100)}`);
          break;
        }
      }
      // Safety net for citations only: if the AI's references slide still drops references, use the
      // engine's exact list so the deck never carries wrong citations.
      if (isRefs && best && best.insp.issues.some((x) => x.type === "references-missing")) {
        const html = referencesSlideHtml(deck, os.title || "References");
        const insp = await inspectSlide(deck, os.n, html, renderDir, "references");
        best = { d: { ...best.d, html: insp.html, provider: "engine", model: "references" }, insp, vision: null, rank: 6 };
        emit("Visual QA", 90, `QA ${os.n}`, "references slide: used the exact reference list");
      }
      done++;
      const b = best!;
      fs.mkdirSync(renderDir, { recursive: true });
      fs.writeFileSync(path.join(renderDir, `preview-${String(os.n).padStart(2, "0")}.jpg`), b.insp.screenshot);
      return {
        n: os.n,
        html: b.d.html,
        notes: b.d.notes,
        provider: b.d.provider,
        model: b.d.model,
        revisions,
        qa: { domIssues: b.insp.issues, visionScore: b.vision?.score, visionIssues: b.vision?.issues, autoFixes: b.insp.autoFixes },
      };
    })
  );
  deck.slides = slides.sort((a, b) => a.n - b.n);
  saveDeck(deck);
  const scored = deck.slides.filter((x) => x.qa?.visionScore);
  const avg = scored.length ? scored.reduce((s, x) => s + (x.qa?.visionScore || 0), 0) / scored.length : 0;
  const clean = deck.slides.filter((x) => !(x.qa?.domIssues || []).some((i) => i.severity !== "low")).length;
  const ctxStats = llmContext.getStore()?.stats;
  if (ctxStats) {
    deck.calls = ctxStats.slice();
    deck.usage = usageSummary(deck.calls);
    console.log(`[v3/usage] deck ${deck.id}: ${usageLine(deck.usage)}`);
    emit("Done", 99, "Owner", `AI usage: ${usageLine(deck.usage)}`);
  }
  emit("Done", 100, "Owner", `Deck ready in ${Math.round((Date.now() - t0) / 1000)}s · ${clean}/${deck.slides.length} slides render cleanly${scored.length ? ` · vision score ${avg.toFixed(1)}/10 on ${scored.length} checked` : ""}`);
  saveDeck(deck);
  return deck;
}
