/**
 * Engine v5 — TEMPLATE engine. Brief → research (v3 + v4 deepening) → PLANNER (one JSON call: template + slots per
 * slide) → theme (code) → photos (v3 sourcing + v4 vetting) → every slide RENDERED BY CODE from a designer-made
 * template → in-browser auto-fit (type scale) → trim if still too long → DOM QA + vision score → preview the moment
 * it is ready. AI calls per deck ≈ 4 (brief, research, planner, photo vet) + 1 vision check per slide, instead of
 * ~8 per slide in v4: speed and rate limits stop deciding the quality, and every slide is designed.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { runBrief } from "../engine-v3/agents/brief";
import { runResearch } from "../engine-v3/agents/research";
import { deepenResearch } from "../engine-v4/deepen";
import { addLogoAsset, logoSlides } from "../engine-v3/assets/logo";
import { sourceImages } from "../engine-v3/assets/images";
import { inspectSlide } from "../engine-v3/qa/inspect";
import { visionReview } from "../engine-v3/qa/vision";
import { formatReference } from "../engine-v3/research/sources";
import { assetDir, deckDir, newDeckId, saveDeck } from "../engine-v3/store";
import { availableProviders, chatJson, llmContext, usageSummary, usageLine } from "../engine-v3/llm";
import { presenterFields } from "../engine-v3/privacy";
import type { Asset, Deck, OutlineSlide, SlideDesign, V3Request } from "../engine-v3/types";
import { isProductShot } from "../engine-v4/photoRules";
import { previewFile, type LiveSlideEvent, type V4Options } from "../engine-v4/pipeline";
import { runPlannerV5, type PlannedSlide } from "./planner";
import { pickTheme, themeDesignSystem } from "./themes";
import { renderSlide, NO_PHOTO } from "./render";
import { templateById, type RenderCtx, type SlideContent } from "./templates";
import { fitSlide, type FitResult } from "./fit";

export type V5Options = V4Options;

async function writePreview(deckId: string, n: number, shot: Buffer) {
  const f = previewFile(deckId, n);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  await sharp(shot).jpeg({ quality: 82, mozjpeg: true }).toFile(f);
}

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

const STATUS: Record<string, string[]> = {
  title: ["Setting the title in the deck's type", "Placing the presenter details"],
  cards: ["Choosing an icon for each idea", "Balancing the cards"],
  diagram: ["Drawing the diagram", "Labelling every part"],
  timeline: ["Placing events on the timeline"],
  process: ["Drawing the steps in order"],
  stat: ["Setting the key number large"],
  photo: ["Framing the photo", "Checking the photo fits the point"],
  data: ["Drawing the chart from the research numbers"],
  compare: ["Lining up both sides"],
  references: ["Formatting the citations"],
};

export async function generateDeckV5(req: V3Request, opts: V5Options = {}): Promise<Deck> {
  const outer = llmContext.getStore();
  if (!outer?.stats) return llmContext.run({ ...(outer || {}), stats: [] }, () => generateDeckV5(req, opts));
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
  const visionMode = (process.env.V5_VISION_QA || opts.visionMode || "smart").toLowerCase();
  const timings: Record<string, number> = {};
  const mark = (k: string, from: number) => (timings[k] = Math.round((Date.now() - from) / 1000));

  emit("Understanding your brief", 3, "Brief", `Engine v5 (designer templates + slot-filling AI). Providers ready: ${availableProviders().join(", ") || "none"}`);
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
  emit("Planning the story", 22, "Planner", "Choosing a designed layout for every slide and writing its content");
  const plan = await runPlannerV5(brief, research, (m) => emit("Planning the story", 26, "Planner", m));
  mark("planner", tt);
  const theme = pickTheme({ topic: req.topic, subject: `${brief.subject} ${brief.title}`, styleHint: req.styleHint || brief.styleHint, suggested: plan.theme });
  const design = themeDesignSystem(theme, brief.language);
  emit("Planning the story", 30, "Planner", `${plan.slides.length} slides · theme ${theme.name} · layouts: ${plan.slides.map((s) => s.template).join(", ")}${plan.repaired.length ? ` — engine fixes: ${plan.repaired.join("; ")}` : ""}`);
  opts.onPlan?.(plan.slides.map((s) => ({ n: s.n, title: s.title, role: s.role, layout: s.template })));

  // citations: sources numbered by first use; at least one credible non-Wikipedia source when research found one
  const citeMap = new Map<string, number>();
  const factSrc = new Map(research.facts.map((f) => [f.id, f.sources]));
  for (const s of plan.slides) for (const fid of s.factIds || []) for (const sid of factSrc.get(fid) || []) if (!citeMap.has(sid)) citeMap.set(sid, citeMap.size + 1);
  if (citeMap.size < 3) for (const src of research.sources) if (!citeMap.has(src.id) && citeMap.size < 6) citeMap.set(src.id, citeMap.size + 1);
  if (![...citeMap.keys()].some((sid) => research.sources.find((s) => s.id === sid)?.kind !== "wikipedia")) {
    const sch = research.sources.find((s) => s.kind !== "wikipedia" && research.facts.some((f) => f.sources.includes(s.id)));
    if (sch) citeMap.set(sch.id, citeMap.size + 1);
  }
  const references = Array.from(citeMap.entries())
    .sort((a, b) => a[1] - b[1])
    .filter(([sid]) => research.sources.some((s) => s.id === sid))
    .map(([sid, n]) => ({ n, sourceId: sid, text: formatReference(research.sources.find((s) => s.id === sid)!, brief.referenceStyle) }));
  const citesOf = (s: PlannedSlide) => [...new Set((s.factIds || []).flatMap((f) => factSrc.get(f) || []).map((sid) => citeMap.get(sid)).filter((x): x is number => !!x))].sort((a, b) => a - b);

  // the outline (kept for exports, notes, live UI and the v3 tools)
  const outline = {
    slides: plan.slides.map<OutlineSlide>((s) => {
      const t = templateById(s.template)!;
      const pts = [...(s.items || []).map((i) => [i.title, i.text].filter(Boolean).join(": ")), ...(s.left?.points || []), ...(s.right?.points || []), s.stat ? `${s.stat.value} ${s.stat.label}` : "", s.takeaway || ""].filter(Boolean);
      return {
        n: s.n,
        role: s.role,
        title: s.title,
        keyMessage: s.lede || s.takeaway || "",
        points: pts.map((text) => ({ text, factIds: s.factIds })),
        visual: t.photo !== "none" && s.photoQuery ? { kind: "photo", query: s.photoQuery } : { kind: t.family === "diagram" ? "diagram" : t.family === "data" ? "chart" : "none" },
        notes: s.notes,
      };
    }),
  };

  // photos for the slides whose template takes one
  tt = Date.now();
  const dir = assetDir(id);
  let assets: Asset[] = [];
  const wantsPhoto = outline.slides.filter((s) => s.visual.kind === "photo");
  // two slides never search the same words (the second uses the planner's alternative query)
  const seenQ = new Set<string>();
  for (const s of wantsPhoto) {
    const q = String(s.visual.query || "").toLowerCase().trim();
    if (seenQ.has(q)) {
      const alt = plan.slides.find((p) => p.n === s.n)?.photoAlt;
      if (alt && !seenQ.has(alt.toLowerCase().trim())) (s.visual as any).query = alt;
    }
    seenQ.add(String(s.visual.query || "").toLowerCase().trim());
  }
  if (wantsPhoto.length && req.imageMode !== "none") {
    emit("Finding images", 32, "Images", `Finding real photos for ${wantsPhoto.length} slide(s): ${wantsPhoto.map((s) => `${s.n} “${s.visual.query}”`).join(", ")}`);
    for (const s of wantsPhoto) slideEvt({ n: s.n, state: "building", status: `Finding a photo: ${s.visual.query}` });
    assets = await sourceImages(wantsPhoto, dir, { mode: req.imageMode || "real-first", topic: brief.title }, (m) => emit("Finding images", 36, "Images", m)).catch(() => []);
    const dropped = await vetPhotos(assets, outline.slides, dir);
    if (dropped.length) {
      assets = assets.filter((a) => !dropped.includes(a));
      emit("Finding images", 37, "Images", `dropped ${dropped.length} photo(s) that did not fit their slide`);
    }
    // a second, different search for the slides still without a photo (the planner's alternative query)
    const missing = wantsPhoto.filter((s) => !assets.some((a) => a.forSlides.includes(s.n)));
    // the title slide falls back to the topic itself ("Photosynthesis", "Blockchain") — Commons has a picture for most topics
    const core = String(req.topic || "").split(/[:–—(|]/)[0].trim();
    const coreQ = /^[\x20-\x7E]{3,60}$/.test(core) ? core : "";
    const retry = missing.map((s) => ({ ...s, visual: { kind: "photo" as const, query: plan.slides.find((p) => p.n === s.n)?.photoAlt || (s.n === 1 ? coreQ : "") } })).filter((s) => s.visual.query && s.visual.query !== wantsPhoto.find((w) => w.n === s.n)?.visual.query);
    if (retry.length) {
      emit("Finding images", 38, "Images", `second search for ${retry.length} slide(s): ${retry.map((s) => `${s.n} “${s.visual.query}”`).join(", ")}`);
      const more = await sourceImages(retry, path.join(dir, "alt"), { mode: req.imageMode || "real-first", topic: brief.title }, (m) => emit("Finding images", 38, "Images", m)).catch(() => [] as Asset[]);
      // the second batch lives in its own folder; ids stay unique next to the first batch
      for (const a of more) {
        a.file = `alt/${a.file}`;
        a.id = `alt${a.id}`;
      }
      const bad = more.length ? await vetPhotos(more, retry, dir) : [];
      assets.push(...more.filter((a) => !bad.includes(a)));
    }
  }
  if (req.logoId) {
    const logo = await addLogoAsset(req.logoId, dir, logoSlides(outline.slides));
    if (logo) assets.push(logo);
  }
  mark("images", tt);

  const deck: Deck = { id, createdAt: new Date().toISOString(), request: req, brief, research, outline: outline as any, design, assets, slides: [], references, log };
  (deck as any).engine = "v5";
  (deck as any).v5 = { theme: theme.id, templates: plan.slides.map((s) => s.template) };
  saveDeck(deck);

  const renderDir = path.join(deckDir(id), "render");
  const fields = presenterFields(req.presenter);
  const logo = assets.find((a) => a.origin === "upload");
  const credits = assets.filter((a) => a.credit && a.origin !== "upload").map((a) => (a.origin === "generated" ? a.credit || "" : `“${a.title.replace(/[_]+/g, " ").replace(/\.\w{3,4}$/, "").slice(0, 50)}” — ${a.credit || ""}`));
  const deckIcons = [...new Set(plan.slides.flatMap((s) => [...(s.items || []).map((i) => i.icon), s.left?.icon, s.right?.icon]).filter((x): x is string => !!x && !/circle-dot|sparkles|hexagon|diamond|triangle|star$|(^|:)(info|circle|help-circle|circle-help|check|x|thumbs-up|thumbs-down)$/.test(x)))].slice(0, 3);
  const heroPhoto = assets.find((a) => a.origin !== "upload" && a.forSlides.includes(1))?.id;
  const ctxBase = { theme, deckIcons, heroPhoto, deckTitle: brief.title, total: plan.slides.length, fields, language: brief.language, deckType: brief.deckType, subject: brief.subject, references: references.map((r) => ({ n: r.n, text: r.text })), credits };
  (deck as any).v5.ctx = ctxBase;

  const slides = new Map<number, SlideDesign>();
  const render = limiter(3);
  const vision = limiter(2);
  let done = 0;
  const visionJobs: Promise<void>[] = [];
  let visionCut = false;
  const stats: { n: number; template: string; s: number; trims: string[]; fill: number; vision?: number; issues: number }[] = [];

  tt = Date.now();
  emit("Designing slides", 40, "Designer", `Rendering ${plan.slides.length} slides from designer templates (theme ${theme.name})`);
  await Promise.all(
    plan.slides.map((ps) =>
      render(async () => {
        const fam = templateById(ps.template)?.family || "cards";
        slideEvt({ n: ps.n, state: "building", status: (STATUS[fam] || STATUS.cards)[0] });
        const photo = assets.find((a) => a.forSlides.includes(ps.n) && a.origin !== "upload");
        const c: SlideContent = { ...ps, photo: photo?.id, cites: ps.template === "references" ? [] : citesOf(ps) };
        const ctx: RenderCtx = { ...ctxBase, n: ps.n, logo: !!logo && !logo.forSlides.includes(ps.n), logoAsset: logo && logo.forSlides.includes(ps.n) ? logo.id : undefined } as RenderCtx;
        const { html, fit, trims, content } = await renderFitted(deck, c, ctx, renderDir, (st) => slideEvt({ n: ps.n, state: "building", status: st }));
        slideEvt({ n: ps.n, state: "building", status: "Checking text fits and contrast" });
        const insp = await inspectSlide(deck, ps.n, html, renderDir, ps.role);
        const issues = insp.issues.filter((i) => i.severity !== "low");
        const sd: SlideDesign = { n: ps.n, html, notes: ps.notes || "", provider: "engine", model: `v5:${c.template}`, qa: { domIssues: insp.issues, autoFixes: [...insp.autoFixes, ...trims] }, revisions: trims.length };
        // the filled template slots, kept so a later edit re-fills slots and re-renders instead of free-form HTML
        (sd as any).v5 = { content, logo: ctx.logo, logoAsset: ctx.logoAsset };
        slides.set(ps.n, sd);
        await writePreview(id, ps.n, insp.screenshot);
        done++;
        deck.slides = Array.from(slides.values()).sort((a, b) => a.n - b.n);
        saveDeck(deck);
        slideEvt({ n: ps.n, state: "ready", status: "Ready", preview: true });
        emit("Designing slides", 40 + Math.round((done / plan.slides.length) * 40), `Slide ${ps.n}`, `${c.template} · type scale ${fit.s} · ${issues.length ? `${issues.length} issue(s): ${issues.map((i) => i.type).join(", ")}` : "clean"}${trims.length ? ` · trimmed: ${trims.join("; ")}` : ""}`);
        const st = { n: ps.n, template: c.template, s: fit.s, trims, fill: fit.fill, issues: issues.length } as (typeof stats)[number];
        stats.push(st);
        // a vision check of the finished slide (scores the deck; a low score with a real problem tries a calmer layout).
        // It runs beside the next renders (never holds a render slot), so a throttled vision model only delays the score.
        const risky = issues.length > 0 || !!photo || /v3-diagram/.test(html) || ps.n === 1;
        if (visionMode !== "off" && (visionMode === "always" || risky)) {
          visionJobs.push(vision(async () => {
            const os = outline.slides.find((x) => x.n === ps.n)!;
            slideEvt({ n: ps.n, state: "polishing", status: "Final look with a designer's eye" });
            const v = await visionReview(insp.screenshot, os, insp.issues, brief.title).catch(() => null);
            if (v) {
              sd.qa!.visionScore = v.score;
              sd.qa!.visionIssues = v.issues;
              st.vision = v.score;
              if (v.score < 6 && ps.n !== 1 && ps.template !== "references" && !visionCut) {
                const alt = calmerTemplate(c);
                if (alt) {
                  const r2 = await renderFitted(deck, { ...c, template: alt }, ctx, renderDir, () => {});
                  const insp2 = await inspectSlide(deck, ps.n, r2.html, renderDir, ps.role);
                  const v2 = await visionReview(insp2.screenshot, os, insp2.issues, brief.title).catch(() => null);
                  if (v2 && v2.score > v.score && !visionCut) {
                    sd.html = r2.html;
                    sd.model = `v5:${alt}`;
                    (sd as any).v5 = { ...(sd as any).v5, content: r2.content };
                    sd.qa = { domIssues: insp2.issues, autoFixes: [...insp2.autoFixes, ...r2.trims, `layout ${c.template} → ${alt} (vision ${v.score} → ${v2.score})`], visionScore: v2.score, visionIssues: v2.issues };
                    st.vision = v2.score;
                    st.template = alt;
                    await writePreview(id, ps.n, insp2.screenshot);
                    emit("Visual QA", 85, `QA ${ps.n}`, `layout ${c.template} → ${alt}: vision ${v.score} → ${v2.score}`);
                  }
                }
              }
              emit("Visual QA", 82, `QA ${ps.n}`, `vision ${st.vision}/10${v.issues?.length ? ` — ${v.issues.slice(0, 2).join("; ").slice(0, 160)}` : ""}`);
            }
            slideEvt({ n: ps.n, state: "done", status: "Done", preview: true });
          }));
        } else slideEvt({ n: ps.n, state: "done", status: "Done", preview: true });
      })
    )
  );
  // vision only scores / double-checks: once every slide is rendered, wait at most V5_VISION_GRACE_S (default 90 s)
  // for throttled checks instead of holding the finished deck for many minutes
  const grace = Number(process.env.V5_VISION_GRACE_S || 90) * 1000;
  const pending = Promise.all(visionJobs).then(() => "done");
  const outcome = await Promise.race([pending, new Promise((r) => setTimeout(() => r("timeout"), grace))]);
  if (outcome === "timeout") {
    visionCut = true;
    emit("Visual QA", 88, "QA", `vision checks still queued after ${Math.round(grace / 1000)}s (free model busy) — finishing without them`);
    for (const ps of plan.slides) slideEvt({ n: ps.n, state: "done", status: "Done" });
  }
  deck.slides = Array.from(slides.values()).sort((a, b) => a.n - b.n);
  mark("slides", tt);

  // hard final gate (same as v4): no raw placeholder anywhere
  for (const s of deck.slides) if (/\{\{/.test(s.html.replace(/<style[\s\S]*?<\/style>/gi, ""))) throw new Error(`slide ${s.n} still carries a raw placeholder`);

  const ctxStats = llmContext.getStore()?.stats;
  if (ctxStats) {
    deck.calls = ctxStats.slice();
    deck.usage = usageSummary(deck.calls);
    console.log(`[v5/usage] deck ${deck.id}: ${usageLine(deck.usage)}`);
    emit("Done", 99, "Owner", `AI usage: ${usageLine(deck.usage)}`);
  }
  timings.total = Math.round((Date.now() - t0) / 1000);
  (deck as any).v5 = { ...(deck as any).v5, timings, planner: { requests: plan.requests, repaired: plan.repaired }, slides: stats.sort((a, b) => a.n - b.n) };
  const scored = deck.slides.filter((x) => x.qa?.visionScore);
  const avg = scored.length ? scored.reduce((s, x) => s + (x.qa?.visionScore || 0), 0) / scored.length : 0;
  emit("Done", 100, "Owner", `Deck ready in ${timings.total}s${scored.length ? ` · vision score ${avg.toFixed(1)}/10 on ${scored.length} slides` : ""}`);
  saveDeck(deck);
  return deck;
}

/** render → fit; if text still overflows at the type floor, trim the lowest-priority content and fit again */
export async function renderFitted(deck: Deck, c0: SlideContent, ctx: RenderCtx, renderDir: string, status: (s: string) => void): Promise<{ html: string; fit: FitResult; trims: string[]; content: SlideContent }> {
  let c: SlideContent = JSON.parse(JSON.stringify(c0));
  const trims: string[] = [];
  let html = renderSlide(c, ctx);
  let fit = await fitSlide(deck as any, ctx.n, html, renderDir);
  for (let k = 0; k < 4 && fit.overflow.length; k++) {
    status("Making the text fit");
    const t = templateById(c.template)!;
    const its = c.items || [];
    if (t.minItems != null && its.length > (t.minItems || 0) && its.length > 3) {
      trims.push(`dropped item “${(its[its.length - 1].title || its[its.length - 1].text || "").slice(0, 30)}”`);
      c.items = its.slice(0, -1);
    } else {
      // shorten the longest text field to its first sentence / 75 %
      const fieldsList: { get: () => string; set: (v: string) => void }[] = [];
      its.forEach((i) => fieldsList.push({ get: () => i.text || "", set: (v) => (i.text = v) }));
      for (const side of [c.left, c.right]) if (side) side.points.forEach((p, j) => fieldsList.push({ get: () => side.points[j], set: (v) => (side.points[j] = v) }));
      if (c.lede) fieldsList.push({ get: () => c.lede || "", set: (v) => (c.lede = v) });
      if (c.stat?.text) fieldsList.push({ get: () => c.stat!.text || "", set: (v) => (c.stat!.text = v) });
      if (c.table) c.table.rows.forEach((r, ri) => r.forEach((_, ci) => fieldsList.push({ get: () => c.table!.rows[ri][ci], set: (v) => (c.table!.rows[ri][ci] = v) })));
      const longest = fieldsList.sort((a, b) => b.get().length - a.get().length)[0];
      if (!longest || longest.get().length < 24) {
        if (c.table && c.table.rows.length > 2) {
          c.table.rows = c.table.rows.slice(0, -1);
          trims.push("dropped a table row");
        } else break;
      } else {
        const v = longest.get();
        const first = v.match(/^(.{20,}?[.!?।])\s/);
        const nv = first && first[1].length < v.length * 0.85 ? first[1] : v.slice(0, Math.round(v.length * 0.75)).replace(/[\s,;:–—-]+\S*$/, "") + "…";
        longest.set(nv);
        trims.push(`shortened “${v.slice(0, 24)}…”`);
      }
    }
    html = renderSlide(c, ctx);
    fit = await fitSlide(deck as any, ctx.n, html, renderDir);
  }
  return { html: fit.html, fit, trims, content: c };
}

/** the calmer layout for a slide the vision check disliked */
function calmerTemplate(c: SlideContent): string | null {
  const n = (c.items || []).length;
  const map: Record<string, string> = { hub: n === 3 ? "cards-3" : n === 4 ? "cards-4" : "takeaways", cycle: "process", matrix: "cards-4", diagram: n <= 5 ? "process" : "takeaways", layers: "process", "icon-rows-photo": n === 3 ? "cards-3" : "cards-4", "photo-split": "text-focus", timeline: n <= 5 ? "process" : "takeaways", chart: "", table: "" };
  const alt = map[c.template];
  if (!alt) return null;
  const t = templateById(alt)!;
  if (t.minItems && n < t.minItems) return null;
  if (t.maxItems && n > t.maxItems) return null;
  return alt;
}

/** vision check of the sourced photos against their slides (same rules as v4); returns the assets to drop */
async function vetPhotos(assets: Asset[], slides: OutlineSlide[], dir: string): Promise<Asset[]> {
  const all = assets.filter((a) => a.origin !== "upload" && a.origin !== "generated");
  const pre = all.filter((a) => {
    const s = slides.find((x) => a.forSlides.includes(x.n));
    return isProductShot(`${a.title || ""} ${a.description || ""}`, `${s?.title || ""} ${s?.keyMessage || ""}`);
  });
  const list = all.filter((a) => !pre.includes(a)).slice(0, 8);
  if (!list.length) return pre;
  try {
    const tw = 360, th = 240, lab = 26;
    const tiles = await Promise.all(list.map(async (a, i) => ({ input: await sharp(path.join(dir, a.file)).resize(tw, th, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer(), left: (i % 4) * (tw + 10), top: Math.floor(i / 4) * (th + lab + 10) + lab })));
    const W = Math.min(4, list.length) * (tw + 10), H = Math.ceil(list.length / 4) * (th + lab + 10);
    const labels = list.map((_, i) => `<text x="${(i % 4) * (tw + 10) + 4}" y="${Math.floor(i / 4) * (th + lab + 10) + 20}" font-size="20" font-family="sans-serif" font-weight="bold">${i + 1}</text>`).join("");
    const sheet = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite([...tiles, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels}</svg>`), left: 0, top: 0 }]).jpeg({ quality: 75 }).toBuffer();
    const lines = list.map((a, i) => {
      const s = slides.find((x) => a.forSlides.includes(x.n));
      return `${i + 1}. slide "${s?.title || "?"}" (message: ${(s?.keyMessage || "-").slice(0, 120)}) — photo searched as "${s?.visual.query || ""}"`;
    });
    const { data } = await chatJson<any>("agent", [{ role: "user", content: [{ type: "text", text: `Each numbered picture was chosen for the slide listed below it. Be strict — a slide with no picture is better than a wrong one.\nREJECT a picture when it: is a product/brand/gadget shot or advert; is mainly a chart, diagram, map, document, screenshot or text; is blurry, tiny, a logo or clip-art; or does not clearly show the slide's subject.\n${lines.join("\n")}\nReply ONLY JSON: {"reject":[numbers],"why":{"n":"reason"}}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${sheet.toString("base64")}` } }] }], { temperature: 0.1, maxTokens: 600, label: "v5 photo vet" });
    const rej: number[] = (Array.isArray(data?.reject) ? data.reject : []).map(Number).filter((x: number) => Number.isInteger(x) && x >= 1 && x <= list.length);
    return [...pre, ...rej.map((x) => list[x - 1])];
  } catch {
    return pre;
  }
}

export { NO_PHOTO };
