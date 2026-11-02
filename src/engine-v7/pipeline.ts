/**
 * Engine v7 — the free-form design engine.
 *   1. content: brief → research (facts + sources) → story (what each slide says)
 *   2. concept: the AI invents this deck's art direction and sketches every slide's visual idea
 *   3. images: up to 5 AI pictures (FLUX.2 klein) in the deck's image style, real photos as fallback
 *   4. slides: for every slide the AI writes a complete HTML/CSS/SVG document for its idea
 *   5. self-check: render in Chromium → in-page measurements + vision review → the AI fixes (max 2 rounds)
 *   6. export: vector PDF + PPTX (one picture per slide)
 * Nothing in here is a template, a layout name or a slide type.
 */
import fs from "fs";
import path from "path";
import { llmContext, type CallStat } from "../engine-v3/llm";
import { closeBrowser } from "../engine-v3/render/browser";
import { research, writeStory, referencesFor } from "./content";
import { makeConcept } from "./concept";
import { resolveFonts } from "./fonts";
import { makeImages } from "./images";
import { designSlide, fillRefs, fixSlide, slidePrompt } from "./slide";
import { finalDocument, renderSlide } from "./render";
import { reviewSlide } from "./qa";
import { exportPdf, exportPptx } from "./export";
import type { V7Concept, V7Deck, V7Request, V7Slide, V7SlideResult } from "./types";

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export interface V7Options { dir: string; log?: (m: string) => void; fixRounds?: number; concurrency?: number }

export async function generateDeckV7(req: V7Request, opts: V7Options) {
  const stats: CallStat[] = [];
  const steps: { name: string; ms: number }[] = [];
  const t0 = Date.now();
  const log = (m: string) => { const line = `[v7 +${Math.round((Date.now() - t0) / 1000)}s] ${m}`; console.log(line); opts.log?.(line); };
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => { const s = Date.now(); const r = await fn(); steps.push({ name, ms: Date.now() - s }); log(`step ${name}: ${Math.round((Date.now() - s) / 1000)} s`); return r; };
  const dir = opts.dir;
  fs.mkdirSync(dir, { recursive: true });
  const fixRounds = opts.fixRounds ?? 2;

  // V7_ROUTES (same shape as ENGINE_V3_ROUTES) pins v7's chains exactly — no opt-in routes are mixed in
  let routes: any;
  try { routes = process.env.V7_ROUTES ? JSON.parse(process.env.V7_ROUTES) : undefined; } catch { routes = undefined; }
  if (routes) for (const k of Object.keys(routes)) routes[k] = routes[k].map((r: any) => typeof r === "string" ? { provider: r.slice(0, r.indexOf(":")), model: r.slice(r.indexOf(":") + 1) } : r);
  return llmContext.run({ stats, routes }, async () => {
    const cfile = path.join(dir, "concept.json");
    let brief: any, pack: any, slides: V7Slide[], references: V7Deck["references"], concept: V7Concept;
    if (process.env.V7_REUSE === "story" && fs.existsSync(cfile)) {
      ({ slides, references } = JSON.parse(fs.readFileSync(cfile, "utf8")));
      brief = { title: slides[0].title };
      pack = { sources: [], facts: [], keyTerms: [] };
      log("reusing the saved story; new concept");
      concept = await step("concept", () => makeConcept(req, slides[0].title, slides, log));
      fs.writeFileSync(cfile, JSON.stringify({ slides, concept, references }, null, 2));
    } else if (process.env.V7_REUSE === "1" && fs.existsSync(cfile)) {
      // prototype convenience: re-design an already planned deck (same story + concept) without new research
      ({ slides, concept, references } = JSON.parse(fs.readFileSync(cfile, "utf8")));
      brief = { title: slides[0].title };
      pack = { sources: [], facts: [], keyTerms: [] };
      log("reusing the saved story + concept");
    } else {
      ({ brief, pack } = await step("research", () => research(req, log)));
      slides = await step("story", () => writeStory(req, brief, pack, log));
      references = referencesFor(slides, pack, req.language);
      concept = await step("concept", () => makeConcept(req, slides[0]?.title || brief.title, slides, log));
      fs.writeFileSync(cfile, JSON.stringify({ slides, concept, references }, null, 2));
    }
    const title = slides[0]?.title || brief.title;
    const imgStats = { ai: 0, checks: 0, photos: 0 };
    const [images, fontRes] = await step("images+fonts", () => Promise.all([
      makeImages(concept, slides, req.topic, dir, Math.min(5, req.aiImages ?? 5), log, imgStats),
      resolveFonts(concept.fonts, log),
    ]));
    log(`images: ${imgStats.ai} AI generated, ${imgStats.photos} real photos, ${images.length} used`);

    // V7_ONLY="2,9": redesign only these slides and keep the others already in the deck folder ("redo this slide")
    const only = (process.env.V7_ONLY || "").split(",").map(Number).filter(Boolean);
    const prevSummary = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, "summary.json"), "utf8")); } catch { return null; } })();
    const results = await step("slides", () => pool(slides, opts.concurrency ?? 3, async (s): Promise<V7SlideResult> => {
      const nn = String(s.n).padStart(2, "0");
      if (only.length && !only.includes(s.n) && fs.existsSync(path.join(dir, `final-${nn}.png`))) {
        const prev = prevSummary?.slides?.find((x: any) => x.n === s.n);
        const kept = await renderSlide(fs.readFileSync(path.join(dir, `final-${nn}.html`), "utf8"), dir, `kept-${nn}`);
        fs.copyFileSync(kept.png, path.join(dir, `final-${nn}.png`));
        return { n: s.n, html: fs.readFileSync(path.join(dir, `final-${nn}.html`), "utf8"), png: path.join(dir, `final-${nn}.png`), rounds: prev?.fixRounds ?? 0, score: prev?.score ?? null, issues: prev?.openIssues ?? [], model: prev?.model ?? "kept" };
      }
      const board = concept.storyboard.find((b) => b.n === s.n)!;
      const isRefs = s.n === slides.length && /reference|source|bibliograph/i.test(s.title);
      const prompt = slidePrompt(s, board, concept, fontRes.fonts, images, concept.storyboard, title, slides.length, isRefs ? references : undefined);
      const tag = `s${String(s.n).padStart(2, "0")}`;
      let cur = await designSlide(prompt, `v7 slide ${s.n}`, isRefs);
      let model = `${cur.meta.provider}:${cur.meta.model}`;
      log(`slide ${s.n}: drafted by ${model} in ${Math.round(cur.meta.ms / 1000)} s`);
      let best: { html: string; png: string; score: number; issues: string[]; round: number } | null = null;
      let round = 0;
      for (;;) {
        const doc = finalDocument(isRefs ? fillRefs(cur.html, references) : cur.html, fontRes.css);
        const r = await renderSlide(doc, dir, `${tag}-r${round}`);
        const v = await reviewSlide(r.jpg, s, r.report.issues, `v7 qa ${s.n}.${round}`);
        const hard = r.report.issues.filter((i) => /cut off|clipped|overflows|failed to load/.test(i));
        // the designer may not write citations itself: anything citation-like outside the engine's list is removed in the fix
        if (isRefs) {
          const own = cur.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
          if (/\bet al\.|\((19|20)\d{2}[a-z]?\)|\b(19|20)\d{2}\)|\[\d+\]/.test(own)) hard.push("the slide contains reference entries you wrote yourself — delete every one of them; the only references allowed are the engine's list that replaces <!--REFS-->");
        }
        const score = v ? v.score - Math.min(3, hard.length) : 7 - Math.min(3, hard.length);
        const problems = [...hard, ...(v?.problems || []), ...r.report.issues.filter((i) => !hard.includes(i)).slice(0, 3)];
        log(`slide ${s.n} round ${round}: score ${v ? v.score : "n/a"}${v ? ` (${v.route})` : ""}, ${r.report.issues.length} measured issues${problems.length ? ` — ${problems.slice(0, 2).join(" | ").slice(0, 220)}` : ""}`);
        if (!best || score > best.score) best = { html: doc, png: r.png, score, issues: problems, round };
        const needsFix = v ? v.fix || hard.length > 0 : hard.length > 0;
        if (!needsFix || round >= fixRounds || !problems.length) break;
        round++;
        try {
          cur = await fixSlide(prompt, cur.html, problems.slice(0, 7), `v7 fix ${s.n}.${round}`, r.jpg, isRefs);
          model = `${cur.meta.provider}:${cur.meta.model}`;
          log(`slide ${s.n}: fix ${round} by ${model} in ${Math.round(cur.meta.ms / 1000)} s`);
        } catch (e: any) {
          log(`slide ${s.n}: fix failed — ${String(e?.message || e).slice(0, 120)}`);
          break;
        }
      }
      fs.writeFileSync(path.join(dir, `final-${String(s.n).padStart(2, "0")}.html`), best!.html);
      fs.copyFileSync(best!.png, path.join(dir, `final-${String(s.n).padStart(2, "0")}.png`));
      return { n: s.n, html: best!.html, png: path.join(dir, `final-${String(s.n).padStart(2, "0")}.png`), rounds: round, score: best!.score, issues: best!.issues, model };
    }));

    const deck: V7Deck = { id: path.basename(dir), dir, request: req, brief, pack, slides, concept, images, results, references };
    const pdf = await step("pdf", () => exportPdf(deck, title));
    fs.writeFileSync(path.join(dir, "deck.pdf"), pdf);
    const pptx = await step("pptx", () => exportPptx(deck, title));
    fs.writeFileSync(path.join(dir, "deck.pptx"), pptx);
    await closeBrowser();
    const summary = {
      title, topic: req.topic, totalSec: Math.round((Date.now() - t0) / 1000), steps,
      llmCalls: stats.length, llmFailed: stats.filter((c) => !c.ok).length,
      byRoute: Object.entries(stats.reduce((a: any, c) => { const k = `${c.role} ${c.provider}:${c.model}${c.ok ? "" : " (failed)"}`; a[k] = a[k] || { n: 0, ms: 0 }; a[k].n++; a[k].ms += c.ms; return a; }, {})).map(([k, v]: any) => ({ route: k, calls: v.n, avgSec: Math.round(v.ms / v.n / 100) / 10 })),
      images: imgStats, concept: { name: concept.conceptName, fonts: fontRes.fonts, palette: concept.palette, motif: concept.motif, imageStyle: concept.imageStyle },
      slides: results.map((r) => ({ n: r.n, title: slides.find((s) => s.n === r.n)?.title, score: r.score, fixRounds: r.rounds, model: r.model, openIssues: r.issues.slice(0, 3) })),
    };
    fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(dir, "calls.json"), JSON.stringify(stats, null, 1));
    log(`done in ${summary.totalSec} s, ${summary.llmCalls} LLM calls`);
    return { deck, summary };
  });
}
