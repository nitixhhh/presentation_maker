/**
 * Engine v4 — re-runs the deterministic end of the v4 pipeline (placeholder gate, finish pass, thin-slide rule) on a
 * saved deck with the current code, then rebuilds previews + PDF/PPTX through the job manager's buildExports.
 *   npx tsx scripts/v4-refinish.ts <deckId> <outDir>
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import sharp from "sharp";
import { loadDeck, saveDeck, deckDir } from "../src/engine-v3/store";
import { finishSlideV4 } from "../src/engine-v4/finish";
import { finalizePlaceholders, sanitizePlaceholders } from "../src/engine-v4/finalize";
import { inspectSlide } from "../src/engine-v3/qa/inspect";
import { fallbackSlideHtml } from "../src/engine-v3/agents/fallbackSlide";
import { buildExports, exportPath } from "../src/server/jobs/manager";
import { closeBrowser } from "../src/engine-v3/render/browser";

(async () => {
  const id = process.argv[2], out = process.argv[3];
  fs.mkdirSync(out, { recursive: true });
  const deck: any = loadDeck(id)!;
  const renderDir = path.join(deckDir(id), "render");
  const citeMap = new Map<string, number>(deck.references.map((r: any) => [r.sourceId, r.n]));
  const fields = deck.brief.titleSlideFields || [];
  for (const s of deck.slides) {
    const os = deck.outline.slides.find((o: any) => o.n === s.n);
    const role = os?.role || "";
    if (role === "references") continue;
    let fin = await finishSlideV4(deck, s.n, sanitizePlaceholders(s.html, fields).html, renderDir, role);
    let insp = await inspectSlide(deck, s.n, fin.html, renderDir, role);
    const log = [...fin.fixes];
    if (os && !["title", "closing", "section", "quote"].includes(role) && os.points.length >= 2) {
      const plain = insp.html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").toLowerCase();
      const shown = os.points.filter((pt: any) => { const w = pt.text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((x: string) => x.length > 2).slice(0, 3); return w.length && w.filter((x: string) => plain.includes(x)).length >= Math.min(2, w.length); }).length;
      const thin = insp.issues.some((x) => x.type === "blank" || x.type === "sparse");
      const highNow = insp.issues.filter((x) => x.severity === "high").length;
      const collided = insp.issues.some((x) => x.severity === "high" && /covered|overlap|past-panel|clipped|overflow/.test(x.type));
      if (shown < Math.ceil(os.points.length / 2) || thin || collided) {
        const f2 = await finishSlideV4(deck, s.n, fallbackSlideHtml(deck, os, citeMap), renderDir, role);
        const i2 = await inspectSlide(deck, s.n, f2.html, renderDir, role);
        const h2 = i2.issues.filter((x) => x.severity === "high").length;
        if (!i2.issues.some((x) => x.type === "blank" || x.type === "sparse") && (shown < Math.ceil(os.points.length / 2) || thin ? h2 <= highNow + 1 : h2 < highNow)) {
          insp = i2; fin = f2; log.push(`${collided ? "overlap" : "thin"} (${shown}/${os.points.length} points, ${highNow} high) → engine layout (${h2} high)`);
        }
      }
    }
    s.html = insp.html;
    const pv = path.join(deckDir(id), "previews", `slide-${String(s.n).padStart(2, "0")}.jpg`);
    await sharp(insp.screenshot).jpeg({ quality: 82, mozjpeg: true }).toFile(pv);
    console.log(s.n, role, log.join(" | "), "|", insp.issues.filter((i) => i.severity !== "low").map((i) => `${i.severity}:${i.type}`).join(","));
  }
  console.log("placeholders:", finalizePlaceholders(deck));
  saveDeck(deck);
  await buildExports(id);
  fs.copyFileSync(exportPath(id, "pdf"), path.join(out, "deck.pdf"));
  fs.copyFileSync(exportPath(id, "pptx"), path.join(out, "deck.pptx"));
  const pdfText = execFileSync("pdftotext", ["-layout", path.join(out, "deck.pdf"), "-"]).toString();
  console.log("PDF {{ :", /\{\{/.test(pdfText), "HTML {{ :", deck.slides.some((s: any) => /\{\{/.test(s.html)));
  const files = deck.slides.map((s: any) => path.join(deckDir(id), "previews", `slide-${String(s.n).padStart(2, "0")}.jpg`));
  const cols = 3, tw = 640, th = 360, pad = 10, rows = Math.ceil(files.length / cols);
  const comps = await Promise.all(files.map(async (f: string, i: number) => ({ input: await sharp(f).resize(tw, th).toBuffer(), left: pad + (i % cols) * (tw + pad), top: pad + Math.floor(i / cols) * (th + pad) })));
  await sharp({ create: { width: pad + cols * (tw + pad), height: pad + rows * (th + pad), channels: 3, background: "#9ca3af" } }).composite(comps).jpeg({ quality: 84 }).toFile(path.join(out, "sheet.jpg"));
  for (const f of files) fs.copyFileSync(f, path.join(out, path.basename(f)));
  await closeBrowser();
  process.exit(0);
})();
