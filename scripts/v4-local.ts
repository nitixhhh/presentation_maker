/**
 * Engine v4 — local runs against the real models (keys from the environment; nothing is printed).
 *   npx tsx scripts/v4-local.ts slide "<topic>" <slideNumber> [slideCount]   → one designer agent (M1)
 *   npx tsx scripts/v4-local.ts deck "<topic>" [slideCount] [language]       → a full v4 deck + contact sheet
 * Output: $V4_OUT (default /tmp/v4out)/<run>/ with slide PNGs, sheet.jpg, stats.json, events.log
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { llmContext, type CallStat } from "../src/engine-v3/llm";
import { runBrief } from "../src/engine-v3/agents/brief";
import { runResearch } from "../src/engine-v3/agents/research";
import { runArtDirector } from "../src/engine-v3/agents/artDirector";
import { inspectSlide } from "../src/engine-v3/qa/inspect";
import { closeBrowser } from "../src/engine-v3/render/browser";
import { renderPngs } from "../src/engine-v3/export/png";
import { exportPdf } from "../src/engine-v3/export/pdf";
import { exportPptx } from "../src/engine-v3/export/pptx";
import { newDeckId, saveDeck, assetDir, deckDir } from "../src/engine-v3/store";
import { runPlanner } from "../src/engine-v4/planner";
import { runDesignerAgent } from "../src/engine-v4/designerAgent";
import { generateDeckV4 } from "../src/engine-v4/pipeline";
import type { Deck } from "../src/engine-v3/types";

const [mode, topic, a3, a4, a5] = process.argv.slice(2);
const run = `${mode}-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
const out = path.join(process.env.V4_OUT || "/tmp/v4out", run);
fs.mkdirSync(out, { recursive: true });
const ev = (s: string) => fs.appendFileSync(path.join(out, "events.log"), `${new Date().toISOString().slice(11, 19)} ${s}\n`);

async function sheet(files: string[], dest: string) {
  const cols = 3, tw = 640, th = 360, pad = 10;
  const rows = Math.ceil(files.length / cols);
  const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(tw, th).jpeg({ quality: 80 }).toBuffer(), left: pad + (i % cols) * (tw + pad), top: pad + Math.floor(i / cols) * (th + pad) })));
  await sharp({ create: { width: pad + cols * (tw + pad), height: pad + rows * (th + pad), channels: 3, background: "#9ca3af" } }).composite(comps).jpeg({ quality: 82 }).toFile(dest);
}

function summarize(stats: CallStat[]) {
  const by: Record<string, { calls: number; failed: number; ms: number }> = {};
  for (const s of stats) {
    const k = `${s.role} ${s.provider}/${s.model}`;
    by[k] ||= { calls: 0, failed: 0, ms: 0 };
    by[k].calls++;
    if (!s.ok) by[k].failed++;
    by[k].ms += s.ms;
  }
  return by;
}

(async () => {
  const stats: CallStat[] = [];
  const t0 = Date.now();
  await llmContext.run({ stats, onWait: (m) => ev(`WAIT ${m}`) }, async () => {
    if (mode === "slide") {
      const want = Number(a3 || 3);
      const req = { topic, slideCount: Number(a4 || 8), language: "English" as const, imageMode: "real-first" as const };
      const brief = await runBrief(req);
      ev(`brief ${brief.title}`);
      const research = await runResearch(brief, (m) => ev(`research ${m}`), topic);
      const plan = await runPlanner(brief, research, (m) => ev(`planner ${m}`));
      fs.writeFileSync(path.join(out, "plan.json"), JSON.stringify(plan.briefs, null, 2));
      ev(`plan ${plan.briefs.length} slides, ${plan.requests} requests; repaired: ${plan.repaired.join("; ")}`);
      const design = await runArtDirector(brief, plan.outline, []);
      const id = newDeckId();
      assetDir(id);
      const deck: Deck = { id, createdAt: new Date().toISOString(), request: req, brief, research, outline: plan.outline, design, assets: [], slides: [], references: [], log: [] };
      saveDeck(deck);
      const os = plan.outline.slides[want - 1];
      const b = plan.briefs[want - 1];
      const ts = Date.now();
      const r = await runDesignerAgent({ deck, os, brief: b, citeMap: new Map(), allowedText: [os.title, os.keyMessage, ...os.points.map((p) => p.text)].join(" "), renderDir: path.join(deckDir(id), "render"), status: (t) => ev(`status ${os.n}: ${t}`) });
      const insp = await inspectSlide(deck, os.n, r.html, path.join(deckDir(id), "render"), os.role);
      fs.writeFileSync(path.join(out, `slide-${want}.jpg`), insp.screenshot);
      fs.writeFileSync(path.join(out, `slide-${want}.html`), r.html);
      fs.writeFileSync(path.join(out, "stats.json"), JSON.stringify({ slide: want, brief: b, seconds: Math.round((Date.now() - ts) / 1000), requests: r.requests, turns: r.turns, checks: r.checks, submitted: r.submitted, fallback: r.fallback, note: r.note, model: r.model, icons: r.iconsUsed, issues: insp.issues, calls: summarize(stats), totalSeconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
      ev(`done slide ${want}: ${r.requests} requests, ${r.turns} turns, submitted=${r.submitted}`);
    } else {
      const req = { topic, slideCount: Number(a3 || 8), language: (a4 || "English") as any, imageMode: "real-first" as const, presenter: a5 ? { names: a5 } : undefined };
      const firstReady: Record<number, number> = {};
      const deck = await generateDeckV4(req, {
        onProgress: (p) => p.log && ev(`[${p.step}] ${p.log.agent}: ${p.log.action}`),
        onPlan: (s) => ev(`PLAN ${s.map((x) => `${x.n}:${x.layout}`).join(" ")}`),
        onSlide: (e) => {
          if (e.state === "ready" && !firstReady[e.n]) firstReady[e.n] = Math.round((Date.now() - t0) / 1000);
          ev(`slide ${e.n} ${e.state}${e.status ? ` — ${e.status}` : ""}`);
        },
      });
      const pngs = await renderPngs(deck, path.join(out, "png"), 1);
      await sheet(pngs, path.join(out, "sheet.jpg"));
      if (process.env.V4_EXPORT === "1") {
        fs.writeFileSync(path.join(out, "deck.pdf"), await exportPdf(deck));
        fs.writeFileSync(path.join(out, "deck.pptx"), await exportPptx(deck));
      }
      const v4 = (deck as any).v4;
      fs.writeFileSync(path.join(out, "stats.json"), JSON.stringify({ deckId: deck.id, slides: deck.slides.length, totalSeconds: Math.round((Date.now() - t0) / 1000), firstSlideReadyAt: firstReady[1], readyAt: firstReady, requests: stats.length, failed: stats.filter((s) => !s.ok).length, byRole: stats.reduce((o: any, s) => ((o[s.role] = (o[s.role] || 0) + 1), o), {}), calls: summarize(stats), v4, review: (deck as any).review, usage: deck.usage, qa: deck.slides.map((s) => ({ n: s.n, model: s.model, score: s.qa?.visionScore, issues: (s.qa?.domIssues || []).filter((i) => i.severity !== "low").map((i) => i.type), revisions: s.revisions })) }, null, 2));
      ev(`DONE ${deck.id} in ${Math.round((Date.now() - t0) / 1000)}s, ${stats.length} AI calls`);
    }
  });
  await closeBrowser();
  process.exit(0);
})().catch(async (e) => {
  ev(`FATAL ${String(e?.stack || e).slice(0, 1500)}`);
  await closeBrowser();
  process.exit(1);
});
