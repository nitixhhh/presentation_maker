/**
 * Engine v5 — re-render a stored v5 deck with the current templates / fit / citation code (no AI unless GROW=1).
 *   DECKCRAFT_V3_DIR=/tmp/x npx tsx scripts/v5-rerender.ts <deck.json> <logo.png|-> <outDir>
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { renderFitted, fillSparse, slideText } from "../src/engine-v5/pipeline";
import { buildReferences, inferFactIds } from "../src/engine-v5/cite";
import { growSlide } from "../src/engine-v5/planner";
import { themeById } from "../src/engine-v5/themes";
import { deckDir, saveDeck } from "../src/engine-v3/store";
import { closeBrowser } from "../src/engine-v3/render/browser";

(async () => {
  const [deckFile, logo, out] = process.argv.slice(2);
  const deck: any = JSON.parse(fs.readFileSync(deckFile, "utf8"));
  deck.id = deck.id + "-rr";
  fs.mkdirSync(path.join(deckDir(deck.id), "assets"), { recursive: true });
  if (logo && logo !== "-") fs.copyFileSync(logo, path.join(deckDir(deck.id), "assets", "logo.png"));
  saveDeck(deck);
  fs.mkdirSync(out, { recursive: true });
  const research = deck.research;
  const slides = deck.slides.map((s: any) => JSON.parse(JSON.stringify(s.v5.content)));
  for (const s of slides) {
    if ((s.factIds || []).length || /^title-/.test(s.template) || ["references", "closing", "agenda", "section"].includes(s.template)) continue;
    const inf = inferFactIds(slideText(s), research.facts);
    if (inf.length) { s.factIds = inf; console.log(`slide ${s.n}: inferred ${inf.join(",")}`); }
  }
  const citeMap = new Map<string, number>();
  const factSrc = new Map(research.facts.map((f: any) => [f.id, f.sources]));
  for (const s of slides) for (const fid of s.factIds || []) for (const sid of (factSrc.get(fid) as string[]) || []) if (!citeMap.has(sid)) citeMap.set(sid, citeMap.size + 1);
  const built = buildReferences([...citeMap.keys()], research.sources, deck.brief.language);
  const refs = built.refs;
  for (const [sid, n] of built.numOf) citeMap.set(sid, n);
  console.log(refs.map((r) => `[${r.n}] ${r.text}`).join("\n"));
  const ctxBase = { ...deck.v5.ctx, theme: themeById(deck.v5.theme) || deck.v5.ctx.theme, references: refs.map((r) => ({ n: r.n, text: r.text, kind: r.kind, count: r.sourceIds.length })) };
  const citesOf = (s: any) => [...new Set((s.factIds || []).flatMap((f: string) => (factSrc.get(f) as string[]) || []).map((sid: string) => citeMap.get(sid)).filter(Boolean))].sort((a: any, b: any) => a - b) as number[];
  const only = (process.env.ONLY || "").split(",").filter(Boolean).map(Number);
  const renderDir = path.join(deckDir(deck.id), "render");
  for (const s of slides) {
    if (only.length && !only.includes(s.n)) continue;
    const old = deck.slides.find((x: any) => x.n === s.n);
    const ctx = { ...ctxBase, n: s.n, logo: old.v5.logo, logoAsset: old.v5.logoAsset };
    const c = { ...s, cites: s.template === "references" ? [] : citesOf(s) };
    let rf = await renderFitted(deck, c, ctx as any, renderDir, () => {});
    console.log(`slide ${s.n} ${c.template}: s=${rf.fit.s} fill=${rf.fit.fill} holes=${JSON.stringify(rf.fit.holes)}`);
    rf = await fillSparse(deck, rf, ctx as any, renderDir, {
      grow: process.env.GROW === "1" ? (cur: any, why) => growSlide(cur, why, deck.brief, research, slides) as any : async () => null,
      cites: citesOf,
      neighbours: slides.filter((o: any) => Math.abs(o.n - s.n) === 1).map((o: any) => o.template),
      say: (m) => console.log(`slide ${s.n}: ${m}`),
      status: () => {},
    });
    const { fitSlide } = await import("../src/engine-v5/fit");
    const shot = await fitSlide(deck, s.n, rf.html, renderDir, { shot: true });
    await sharp(shot.screenshot!).jpeg({ quality: 88 }).toFile(path.join(out, `slide-${String(s.n).padStart(2, "0")}.jpg`));
  }
  await closeBrowser();
})().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });
