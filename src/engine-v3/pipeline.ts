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
import { designSlide, reviseSlide, fallbackDesign, type DesignOut } from "./agents/designer";
import { sourceImages } from "./assets/images";
import { inspectSlide, type Inspection } from "./qa/inspect";
import { visionReview, type VisionVerdict } from "./qa/vision";
import { formatReference } from "./research/sources";
import { referencesSlideHtml } from "./agents/referencesSlide";
import { assetDir, deckDir, newDeckId, saveDeck } from "./store";
import { availableProviders } from "./llm";
import type { Deck, ProgressFn, SlideDesign, V3Request } from "./types";

export interface PipelineOptions {
  onProgress?: ProgressFn;
  maxRevisions?: number; // per slide, default 2
  vision?: boolean; // default true
  onDeckId?: (id: string) => void; // called as soon as the deck id exists
}

export async function generateDeckV3(req: V3Request, opts: PipelineOptions = {}): Promise<Deck> {
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
  const useVision = opts.vision ?? process.env.V3_VISION_QA !== "off";

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
  const assets = await sourceImages(outline.slides, dir, { mode: req.imageMode || "real-first", topic: brief.title }, (m) => emit("Finding images", 40, "Images", m));
  const design = await runArtDirector(brief, outline, assets);
  emit("Designing the look + finding images", 46, "ArtDirector", `${design.name}: ${design.font.heading}/${design.font.body}, motif — ${design.motif}`);

  const deck: Deck = { id, createdAt: new Date().toISOString(), request: req, brief, research, outline, design, assets, slides: [], references, log };
  saveDeck(deck);

  // Designers in parallel (provider pool throttles), each followed by its own QA loop
  const renderDir = path.join(deckDir(id), "render");
  let done = 0;
  const total = outline.slides.length;
  const slides: SlideDesign[] = await Promise.all(
    outline.slides.map(async (os, i): Promise<SlideDesign> => {
      let d: DesignOut;
      if (os.role === "references") {
        const html = referencesSlideHtml(deck, os.title || "References");
        const insp = await inspectSlide(deck, os.n, html, renderDir, "references");
        fs.mkdirSync(renderDir, { recursive: true });
        fs.writeFileSync(path.join(renderDir, `preview-${String(os.n).padStart(2, "0")}.jpg`), insp.screenshot);
        done++;
        return { n: os.n, html: insp.html, notes: "", provider: "engine", model: "references", revisions: 0, qa: { domIssues: insp.issues, autoFixes: insp.autoFixes } };
      }
      try {
        d = await designSlide(deck, os, citeMap, i);
      } catch (e: any) {
        emit("Designing slides", 50, "Designer", `slide ${os.n}: all providers failed, using engine fallback (${String(e.message).slice(0, 120)})`);
        d = fallbackDesign(os, deck);
      }
      emit("Designing slides", 50 + Math.round((done / total) * 30), `Designer ${os.n}`, `drafted "${os.title}" (${d.provider}/${d.model})`);
      type Rec = { d: DesignOut; insp: Inspection; vision: VisionVerdict | null; rank: number };
      let best: Rec | null = null;
      let revisions = 0;
      for (let round = 0; round <= maxRevisions; round++) {
        const allowed = [os.title, os.keyMessage, ...os.points.map((x) => x.text), ...os.points.flatMap((x) => (x.factIds || []).map((id) => research.facts.find((f) => f.id === id)?.text || "")), ...brief.titleSlideFields.map((f) => f.value), brief.title, String(new Date().getFullYear())].join(" ");
        const insp = await inspectSlide(deck, os.n, d.html, renderDir, os.role, allowed);
        const vision = useVision ? await visionReview(insp.screenshot, os, insp.issues, brief.title) : null;
        const high = insp.issues.filter((x) => x.severity === "high").length;
        const med = insp.issues.filter((x) => x.severity === "medium").length;
        const score = vision?.score ?? (high ? 4 : 7);
        const rank = score - 2 * high - 0.5 * med;
        const rec: Rec = { d: { ...d, html: insp.html }, insp, vision, rank };
        if (!best || rank > best.rank) best = rec;
        const needFix = high > 0 || !!vision?.fix;
        emit("Visual QA", 55 + Math.round((done / total) * 35), `QA ${os.n}`, `round ${round + 1}: score ${vision?.score ?? "–"}/10, ${high} serious + ${med} minor issues${insp.autoFixes.length ? `, auto-fit ${insp.autoFixes.length}` : ""}`);
        if (!needFix || round === maxRevisions) break;
        const feedback = [...insp.issues.map((x) => `- [${x.severity}] ${x.detail}`), ...(vision?.issues || []).map((x) => `- ${x}`)].join("\n");
        if (!d.messages.length) break;
        try {
          d = await reviseSlide({ ...d, html: insp.html }, feedback);
          revisions++;
        } catch (e: any) {
          emit("Visual QA", 60, `QA ${os.n}`, `revision unavailable: ${String(e.message).slice(0, 100)}`);
          break;
        }
      }
      // last resort: a slide that is still broken (overlap/cut-off) is worse than a plain clean one
      if (best && best.insp.issues.filter((x) => x.severity === "high").length >= 2) {
        const fb = fallbackDesign(os, deck);
        const insp = await inspectSlide(deck, os.n, fb.html, renderDir, os.role);
        if (insp.issues.filter((x) => x.severity === "high").length === 0) {
          emit("Visual QA", 90, `QA ${os.n}`, "design still had layout errors after revisions — using the clean engine layout for this slide");
          best = { d: { ...fb, html: insp.html }, insp, vision: null, rank: 6 };
        }
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
  const avg = deck.slides.reduce((s, x) => s + (x.qa?.visionScore || 0), 0) / deck.slides.length;
  emit("Done", 100, "Owner", `Deck ready in ${Math.round((Date.now() - t0) / 1000)}s · average QA score ${avg.toFixed(1)}/10`);
  saveDeck(deck);
  return deck;
}
