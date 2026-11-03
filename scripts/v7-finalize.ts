/**
 * Prototype helper: finish a v7 deck whose run was stopped during its fix rounds. Re-measures every rendered round of
 * every slide with the current in-page checks (no AI calls), scores it with the pipeline's formula (reviewer score from
 * the run log − 1.5 per hard issue), keeps the best round per slide, then writes final-NN.* + PDF + PPTX.
 *   tsx scripts/v7-finalize.ts <deck dir> <run log>
 */
import fs from "fs";
import path from "path";
import { renderSlide, emptyRegion, finalDocument } from "../src/engine-v7/render";
import { exportPdf, exportPptx } from "../src/engine-v7/export";
import { closeBrowser } from "../src/engine-v3/render/browser";

const HARD = /cut off|clipped|overflows|failed to load|too small|overlaps|empty framed box|large empty area|planned visual is missing|roughen|running header|touches the slide edge|spills out|wider than the box|runs off the slide/i;
(async () => {
  const [dir, logFile] = process.argv.slice(2);
  const { slides, concept, references } = JSON.parse(fs.readFileSync(path.join(dir, "concept.json"), "utf8"));
  const log = fs.readFileSync(logFile, "utf8");
  const vision: Record<string, number> = {};
  for (const m of log.matchAll(/slide (\d+) round (\d+): score (\d+|n\/a)/g)) vision[`${m[1]}.${m[2]}`] = m[3] === "n/a" ? 7 : Number(m[3]);
  const models: Record<string, string> = {};
  for (const m of log.matchAll(/slide (\d+): (?:drafted|fix (\d+)) by (\S+)/g)) models[`${m[1]}.${m[2] || 0}`] = m[3];
  const tmp = path.join(dir, "remeasure");
  fs.mkdirSync(tmp, { recursive: true });
  const results: any[] = [];
  const out: any[] = [];
  for (const s of slides) {
    const nn = String(s.n).padStart(2, "0");
    const isRefs = s.n === slides.length && /reference|source|bibliograph/i.test(s.title);
    const board = concept.storyboard.find((b: any) => b.n === s.n) || {};
    let best: any = null;
    for (let round = 0; round < 4; round++) {
      const f = path.join(dir, `s${nn}-r${round}.html`);
      if (!fs.existsSync(f) || vision[`${s.n}.${round}`] === undefined) continue;
      const html = fs.readFileSync(f, "utf8");
      fs.copyFileSync(f, path.join(dir, `cand-${nn}-${round}.html`));
      const r = await renderSlide(html, dir, `cand-${nn}-${round}`);
      const measured = [...r.report.issues];
      if (!isRefs) {
        const e = await emptyRegion(r.png);
        if (e.share >= 0.26) measured.push(`${e.share >= 0.38 ? "large empty area" : "big empty area"} ${Math.round(e.share * 100)}%`);
        const planned = /diagram|chart|graph|plot|tree|timeline|map\b|network|flow|cycle|venn|grid|axis|bars?\b|curve|illustrat|cross.?section|scale|funnel|matrix|photo|image|picture|icon|drawing|dots?\b/i.test(board.visual || "");
        if (planned && (r.report.graphicShare ?? 1) < 0.04) measured.push("the planned visual is missing");
      }
      const hard = measured.filter((i) => HARD.test(i));
      const score = vision[`${s.n}.${round}`] - Math.min(6, hard.length * 1.5);
      out.push({ n: s.n, round, vision: vision[`${s.n}.${round}`], score, hard: hard.map((h) => h.slice(0, 140)) });
      if (!best || score > best.score) best = { round, score, html, png: r.png, hard, model: models[`${s.n}.${round}`] };
    }
    // the engine's deterministic repairs (font floor, nudge inside the margin) on the kept version; kept only if fewer hard issues
    {
      const a = await renderSlide(best.html, dir, `auto-${nn}`, { floor: true });
      if (a.floored) {
        const css = (best.html.match(/<style id="v7-fonts">([\s\S]*?)<\/style>/) || [])[1] || "";
        const doc = finalDocument(a.floored.html, css);
        const b = await renderSlide(doc, dir, `auto-${nn}`);
        const hard = b.report.issues.filter((i) => HARD.test(i));
        console.log(`slide ${s.n}: engine repairs (${a.floored.count}) → hard issues ${best.hard.length} -> ${hard.length}`);
        if (hard.length < best.hard.length) best = { ...best, html: doc, png: b.png, hard, score: best.score + 1.5 * (best.hard.length - hard.length), model: best.model + " + engine repair" };
      }
    }
    fs.writeFileSync(path.join(dir, `final-${nn}.html`), best.html);
    fs.copyFileSync(best.png, path.join(dir, `final-${nn}.png`));
    results.push({ n: s.n, png: path.join(dir, `final-${nn}.png`), round: best.round, score: best.score, hardLeft: best.hard, model: best.model });
    console.log(`slide ${s.n}: keep round ${best.round} (score ${best.score}, ${best.model}) ${best.hard.length ? "— still: " + best.hard.join(" | ").slice(0, 300) : ""}`);
  }
  const deck: any = { dir, slides, references, results };
  const title = slides[0].title;
  fs.writeFileSync(path.join(dir, "deck.pdf"), await exportPdf(deck, title));
  fs.writeFileSync(path.join(dir, "deck.pptx"), await exportPptx(deck, title));
  fs.writeFileSync(path.join(dir, "finalize.json"), JSON.stringify({ candidates: out, kept: results.map((r) => ({ n: r.n, round: r.round, score: r.score, model: r.model, hardLeft: r.hardLeft })) }, null, 1));
  await closeBrowser();
  process.exit(0);
})();
