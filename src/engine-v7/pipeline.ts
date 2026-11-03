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
import { finalDocument, renderSlide, emptyRegion, MIN_FONT_PX } from "./render";
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


/** measured problems that always force a fix round (and cost score) — never left as a soft note */
const HARD = /cut off|clipped|overflows|failed to load|too small|overlaps|empty framed box|large empty area|planned visual is missing|roughen|running header|touches the slide edge|spills out|wider than the box|runs off the slide/i;
const EMPTY_SOFT = Number(process.env.V7_EMPTY_SOFT || 0.26);
const EMPTY_HARD = Number(process.env.V7_EMPTY_HARD || 0.38);

/** the designer's own document from a finalized one (engine-injected fonts + canvas guard removed) */
export function stripEngine(html: string): string {
  return html.replace(/<style id="v7-fonts">[\s\S]*?<\/style>/i, "").replace(/<style id="v7-guard">[\s\S]*?<\/style>/i, "");
}

/** running headers differ only in their numbers ("SECTION 02 · p. 3/9"): compare them without digits */
const chromeKey = (t: string) => t.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

const isGeminiFlash = (provider: string, model: string) => provider === "google" && /^gemini-/i.test(model) && !/lite/i.test(model);
const isRateLimit = (err?: string) => /\b429\b|rate.?limit|quota|exhausted|too many requests/i.test(err || "");

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

    // Gemini Flash budget: the free tier is ~20 requests/day per model and is shared with the live site, so v7 counts
    // every Gemini Flash request (concept, drafts, fixes; across runs via V7_GEMINI_LEDGER) and stops at its caps:
    // V7_GEMINI_PER_MODEL per model per day, V7_GEMINI_BUDGET per deck. Drafts are reserved first; fixes use what is left.
    const ledgerFile = process.env.V7_GEMINI_LEDGER;
    const base: Record<string, number> = (() => { try { return ledgerFile ? JSON.parse(fs.readFileSync(ledgerFile, "utf8")) : {}; } catch { return {}; } })();
    const perModelCap = Number(process.env.V7_GEMINI_PER_MODEL || 20);
    const runCap = Number(process.env.V7_GEMINI_BUDGET || 1e9);
    const counted = (c: CallStat) => isGeminiFlash(c.provider, c.model) && (c.ok || !isRateLimit((c as any).error));
    const runUsed = () => stats.filter(counted).length;
    const usedBy = (model: string) => (base[model] || 0) + stats.filter((c) => counted(c) && c.model === model).length;
    const saveLedger = () => {
      if (!ledgerFile) return;
      const all: Record<string, number> = { ...base };
      for (const c of stats) if (counted(c)) all[c.model] = (all[c.model] || 0) + 1;
      try { fs.writeFileSync(ledgerFile, JSON.stringify(all, null, 1)); } catch {}
    };
    let reserved = 0;
    const resBy: Record<string, number> = {};
    let draftsLeft = slides.length;
    const fallbackFixes = process.env.V7_FIX_FALLBACK === "1";
    const gemFree = () => ((routes?.design || []) as any[]).filter((r) => isGeminiFlash(r.provider, r.model) && usedBy(r.model) + (resBy[r.model] || 0) < perModelCap);
    const budgetLeft = (draft: boolean) => {
      if (draft) return true;
      if (gemFree().length && runUsed() + reserved + draftsLeft < runCap) return true;
      // Gemini budget spent: a fix may still go to the free non-Gemini designers (the best version is kept anyway)
      return fallbackFixes && ((routes?.design || []) as any[]).some((r) => !isGeminiFlash(r.provider, r.model));
    };
    /** one design-role call: Gemini Flash models under their cap first (least used first), then the rest of the chain */
    const designCall = async <T>(fn: () => Promise<T>, draft: boolean): Promise<T> => {
      const chain: any[] = routes?.design || [];
      const roomForFix = draft || runUsed() + reserved + draftsLeft < runCap;
      const okGem = roomForFix ? gemFree().sort((x, y) => usedBy(x.model) + (resBy[x.model] || 0) - usedBy(y.model) - (resBy[y.model] || 0)) : [];
      const rest = chain.filter((r) => !isGeminiFlash(r.provider, r.model));
      const design = [...okGem, ...rest];
      const lead = okGem[0]?.model;
      reserved++;
      if (lead) resBy[lead] = (resBy[lead] || 0) + 1;
      if (draft) draftsLeft--;
      try {
        return await llmContext.run({ stats, routes: { ...(routes || {}), design } } as any, fn);
      } finally { reserved--; if (lead) resBy[lead]--; saveLedger(); }
    };
    saveLedger();
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
    const conc = opts.concurrency ?? 3;

    type St = {
      s: V7Slide; nn: string; tag: string; prompt: string; isRefs: boolean; board: V7Concept["storyboard"][number];
      cur: { html: string }; model: string; round: number; kept?: V7SlideResult;
      best: { html: string; png: string; jpg: Buffer; score: number; issues: string[]; hard: string[]; round: number } | null;
      last: { jpg: Buffer; problems: string[]; hard: string[]; needsFix: boolean } | null;
      edgeTexts: string[];
    };
    const states: St[] = slides.map((s) => {
      const board = concept.storyboard.find((b) => b.n === s.n) || { n: s.n, visual: "", composition: "" };
      const isRefs = s.n === slides.length && /reference|source|bibliograph/i.test(s.title);
      const nn = String(s.n).padStart(2, "0");
      return { s, nn, tag: `s${nn}`, isRefs, board, prompt: slidePrompt(s, board, concept, fontRes.fonts, images, concept.storyboard, title, slides.length, isRefs ? references : undefined), cur: { html: "" }, model: "", round: 0, best: null, last: null, edgeTexts: [] };
    });

    /** render + measure + review the current version; keeps the best-scoring version of the slide */
    let repeated: string[] = [];
    const chromeIssue = (st: St) => {
      const hit = st.edgeTexts.filter((t) => repeated.includes(chromeKey(t)));
      return hit.length ? [`remove the running header/footer ${hit.map((t) => `"${t.slice(0, 50)}"`).join(", ")} (and any decorative strip that carries it) — no repeated page chrome; give that space to the content`] : [];
    };
    const evaluate = async (st: St) => {
      const { s, isRefs } = st;
      let doc = finalDocument(isRefs ? fillRefs(st.cur.html, references) : st.cur.html, fontRes.css);
      const r = await renderSlide(doc, dir, `${st.tag}-r${st.round}`, { floor: true });
      if (r.floored) {
        // the engine raised r.floored.count too-small texts to the minimum size itself (no AI call); keep that version
        doc = finalDocument(r.floored.html, fontRes.css);
        fs.writeFileSync(r.file, doc);
        if (!isRefs) st.cur = { html: r.floored.html };
        log(`slide ${s.n} round ${st.round}: engine repaired ${r.floored.count} texts itself (raised to ${MIN_FONT_PX}px / nudged inside the margin)`);
      }
      st.edgeTexts = r.report.edgeTexts || [];
      const measured = [...r.report.issues];
      // large flat empty areas = unfinished slide (references slide excepted)
      if (!isRefs) {
        const e = await emptyRegion(r.png).catch(() => null);
        if (e && e.share >= EMPTY_SOFT) measured.push(`${e.share >= EMPTY_HARD ? "large empty area" : "big empty area (check it is intended)"}: about ${e.box[2]}x${e.box[3]}px at x=${e.box[0]}, y=${e.box[1]} (${Math.round(e.share * 100)}% of the slide) is blank — the slide looks unfinished; make the main visual fill the space or rebalance the composition`);
        // the storyboard planned a drawing/picture, but nothing drawn is on the slide
        const plannedVisual = /diagram|chart|graph|plot|tree|timeline|map\b|network|flow|cycle|venn|grid|axis|bars?\b|curve|illustrat|cross.?section|scale|funnel|matrix|photo|image|picture|icon|drawing|dots?\b/i.test(st.board.visual || "");
        if (plannedVisual && (r.report.graphicShare ?? 1) < 0.04) measured.push(`the planned visual is missing (sketch: "${String(st.board.visual).slice(0, 140)}") — draw it, big and complete, in SVG`);
      }
      const v = await reviewSlide(r.jpg, s, measured, `v7 qa ${s.n}.${st.round}`);
      const hard = [...measured.filter((i) => HARD.test(i)), ...chromeIssue(st)];
      // the designer may not write citations itself: anything citation-like outside the engine's list is removed in the fix
      if (isRefs) {
        const own = st.cur.html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
        if (/\bet al\.|\((19|20)\d{2}[a-z]?\)|\b(19|20)\d{2}\)|\[\d+\]/.test(own)) hard.push("the slide contains reference entries you wrote yourself — delete every one of them; the only references allowed are the engine's list that replaces <!--REFS-->");
      }
      // a measured failure always costs more than any taste point the reviewer gives
      const penalty = Math.min(6, hard.length * 1.5);
      const score = (v ? v.score : 7) - penalty;
      const problems = [...hard, ...(v?.problems || []), ...measured.filter((i) => !hard.includes(i)).slice(0, 3)];
      log(`slide ${s.n} round ${st.round}: score ${v ? v.score : "n/a"}${v ? ` (${v.route})` : ""} - ${penalty} = ${score}, ${hard.length} hard issues${problems.length ? ` — ${problems.slice(0, 2).join(" | ").slice(0, 240)}` : ""}`);
      if (!st.best || score > st.best.score) st.best = { html: doc, png: r.png, jpg: r.jpg, score, issues: problems, hard, round: st.round };
      else log(`slide ${s.n} round ${st.round}: worse than round ${st.best.round} (${st.best.score}) — keeping round ${st.best.round}`);
      st.last = { jpg: r.jpg, problems, hard, needsFix: (v ? v.fix || v.score < 7 : false) || hard.length > 0 };
    };

    // phase 1: every slide drafted, rendered and reviewed
    await step("slides", () => pool(states, conc, async (st) => {
      const { s, nn } = st;
      // V7_ONLY_MODE=fix: the listed slides start from their saved final version (which stays the one to beat) and go
      // straight to fix rounds — a "fix this slide" that can never make the deck worse
      if (only.includes(s.n) && process.env.V7_ONLY_MODE === "fix" && fs.existsSync(path.join(dir, `final-${nn}.html`))) {
        st.cur = { html: stripEngine(fs.readFileSync(path.join(dir, `final-${nn}.html`), "utf8")) };
        st.model = "kept";
        draftsLeft--;
        st.round = 0;
        await evaluate(st);
        if (st.last) st.last.needsFix = true;
        return;
      }
      if (only.length && !only.includes(s.n) && fs.existsSync(path.join(dir, `final-${nn}.png`))) {
        draftsLeft--;
        const prev = prevSummary?.slides?.find((x: any) => x.n === s.n);
        const kept = await renderSlide(fs.readFileSync(path.join(dir, `final-${nn}.html`), "utf8"), dir, `kept-${nn}`);
        fs.copyFileSync(kept.png, path.join(dir, `final-${nn}.png`));
        st.kept = { n: s.n, html: fs.readFileSync(path.join(dir, `final-${nn}.html`), "utf8"), png: path.join(dir, `final-${nn}.png`), rounds: prev?.fixRounds ?? 0, score: prev?.score ?? null, issues: prev?.openIssues ?? [], model: prev?.model ?? "kept" };
        return;
      }
      const d = await designCall(() => designSlide(st.prompt, `v7 slide ${s.n}`, st.isRefs), true);
      st.cur = { html: d.html };
      st.model = `${d.meta.provider}:${d.meta.model}`;
      log(`slide ${s.n}: drafted by ${st.model} in ${Math.round(d.meta.ms / 1000)} s`);
      await evaluate(st);
    }));

    // repeated chrome: the same short text in the top/bottom band of 3+ slides is a running header/footer → hard failure there
    repeated = (() => {
      const count = new Map<string, number>();
      for (const st of states) for (const t of new Set(st.edgeTexts.map(chromeKey))) if (!slides.some((x) => chromeKey(x.title) === t)) count.set(t, (count.get(t) || 0) + 1);
      return [...count.entries()].filter(([t, c]) => c >= 3 && t.replace(/[^a-z]/g, "").length >= 1).map(([t]) => t);
    })();
    if (repeated.length) log(`running header/footer repeated across slides: ${repeated.map((t) => `"${t.slice(0, 40)}"`).join(", ")}`);
    if (repeated.length) for (const st of states) {
      const ch = chromeIssue(st);
      if (ch.length && st.best && st.last) { st.best.score -= 1.5; st.best.hard.push(...ch); st.best.issues.unshift(...ch); st.last.hard.push(...ch); st.last.problems.unshift(...ch); st.last.needsFix = true; }
    }

    // phase 2: fix rounds — slides with hard failures first, then the lowest scores, while the design budget lasts
    for (let round = 1; round <= fixRounds; round++) {
      const todo = states.filter((st) => !st.kept && st.last?.needsFix && st.last.problems.length)
        .sort((a, b) => (b.last!.hard.length > 0 ? 1 : 0) - (a.last!.hard.length > 0 ? 1 : 0) || a.best!.score - b.best!.score);
      if (!todo.length) break;
      await step(`fix round ${round}`, () => pool(todo, conc, async (st) => {
        if (!budgetLeft(false)) { log(`slide ${st.s.n}: no design budget left for fix ${round} — keeping round ${st.best!.round}`); return; }
        // fix from the best version so far, not from a version that got worse
        const fromBest = st.best!.round !== st.round && !st.isRefs;
        const base = fromBest ? stripEngine(st.best!.html) : st.cur.html;
        const problems = fromBest ? st.best!.issues : st.last!.problems;
        const shot = fromBest ? st.best!.jpg : st.last!.jpg;
        st.round = round;
        try {
          const d = await designCall(() => fixSlide(st.prompt, base, problems.slice(0, 8), `v7 fix ${st.s.n}.${round}`, shot, st.isRefs), false);
          st.cur = { html: d.html };
          st.model = `${d.meta.provider}:${d.meta.model}`;
          log(`slide ${st.s.n}: fix ${round} by ${st.model} in ${Math.round(d.meta.ms / 1000)} s`);
        } catch (e: any) {
          log(`slide ${st.s.n}: fix ${round} failed — ${String(e?.message || e).slice(0, 140)}`);
          st.last!.needsFix = false;
          return;
        }
        await evaluate(st);
      }));
    }

    const results: V7SlideResult[] = states.map((st) => {
      if (st.kept) return st.kept;
      const f = path.join(dir, `final-${st.nn}.html`);
      fs.writeFileSync(f, st.best!.html);
      fs.copyFileSync(st.best!.png, path.join(dir, `final-${st.nn}.png`));
      return { n: st.s.n, html: st.best!.html, png: path.join(dir, `final-${st.nn}.png`), rounds: st.round, score: st.best!.score, issues: st.best!.issues, model: st.model, keptRound: st.best!.round, hardLeft: st.best!.hard.length } as V7SlideResult;
    });

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
      geminiFlashRequests: runUsed(), geminiByModel: Object.fromEntries([...new Set(stats.filter(counted).map((c) => c.model))].map((m) => [m, stats.filter((c) => counted(c) && c.model === m).length])),
      slides: results.map((r: any) => ({ n: r.n, title: slides.find((s) => s.n === r.n)?.title, score: r.score, fixRounds: r.rounds, keptRound: r.keptRound, hardLeft: r.hardLeft, model: r.model, openIssues: r.issues.slice(0, 4) })),
    };
    fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(dir, "calls.json"), JSON.stringify(stats, null, 1));
    log(`done in ${summary.totalSec} s, ${summary.llmCalls} LLM calls`);
    return { deck, summary };
  });
}
