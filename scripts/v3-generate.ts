/**
 * Engine v3 CLI — generate a deck and export PDF + PPTX (+ PNG renders of every slide).
 *
 *   npx tsx scripts/v3-generate.ts request.json out-dir
 *
 * request.json follows V3Request (src/engine-v3/types.ts), e.g.
 *   {"topic":"UV-Vis Spectroscopy","audience":"B.Sc 2nd year chemistry","slideCount":10,"language":"English"}
 */
import fs from "fs";
import path from "path";
import { generateDeckV3 } from "../src/engine-v3/pipeline";
import { exportPdf } from "../src/engine-v3/export/pdf";
import { exportPptx } from "../src/engine-v3/export/pptx";
import { renderPngs } from "../src/engine-v3/export/png";
import { closeBrowser } from "../src/engine-v3/render/browser";
import { loadDeck } from "../src/engine-v3/store";

async function main() {
  const [reqFile, outDir, existingId] = process.argv.slice(2);
  if (!reqFile || !outDir) {
    console.error("usage: tsx scripts/v3-generate.ts request.json out-dir [existing-deck-id]");
    process.exit(1);
  }
  const req = JSON.parse(fs.readFileSync(reqFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  const deck = existingId
    ? loadDeck(existingId)!
    : await generateDeckV3(req, {
        onProgress: (p) => console.log(`[${String(p.percent).padStart(3)}%] ${p.log?.agent || ""}: ${p.log?.action || p.step}`),
      });
  const base = (req.outName || deck.brief.title).replace(/[^a-z0-9\u0900-\u097F]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60);
  console.log(`deck ${deck.id} generated in ${Math.round((Date.now() - t0) / 1000)}s`);
  const [pdf, pptx] = await Promise.all([exportPdf(deck), exportPptx(deck)]);
  fs.writeFileSync(path.join(outDir, `${base}.pdf`), pdf);
  fs.writeFileSync(path.join(outDir, `${base}.pptx`), pptx);
  const pngDir = path.join(outDir, `${base}_slides`);
  await renderPngs(deck, pngDir);
  fs.writeFileSync(path.join(outDir, `${base}_deck.json`), JSON.stringify({ ...deck, research: { ...deck.research, sources: deck.research.sources.map((s) => ({ ...s, text: s.text.slice(0, 300) + "…" })) } }, null, 2));
  console.log(`exported → ${outDir} (${base}.pdf, ${base}.pptx, ${pngDir})`);
  await closeBrowser();
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  process.exit(1);
});
