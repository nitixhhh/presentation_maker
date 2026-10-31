/** Engine v3 — PDF export: Chromium prints each slide exactly as rendered; pages merged with pdf-lib. */
import path from "path";
import { PDFDocument } from "pdf-lib";
import { openSlide, closePage, pool, renderLimit } from "../render/browser";
import { slideDocument } from "../render/document";
import { deckDir } from "../store";
import type { Deck } from "../types";

const PRINT_HEAD = `<style>@page{size:1280px 720px;margin:0}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>`;

export async function exportPdf(deck: Deck): Promise<Buffer> {
  const renderDir = path.join(deckDir(deck.id), "render");
  const pages = await pool(deck.slides, renderLimit(4), async (s) => {
    const doc = slideDocument(deck.design, s.html, { assetBase: "../assets/", deck, n: s.n, extraHead: PRINT_HEAD });
    const page = await openSlide(doc, renderDir, `pdf-${String(s.n).padStart(2, "0")}`);
    try {
      return await page.pdf({ width: "1280px", height: "720px", printBackground: true, pageRanges: "1", preferCSSPageSize: true });
    } finally {
      await closePage(page);
    }
  });
  const out = await PDFDocument.create();
  out.setTitle(deck.brief.title);
  out.setCreator("DeckCraft AI — Engine v3");
  for (const buf of pages) {
    const src = await PDFDocument.load(buf);
    const [p] = await out.copyPages(src, [0]);
    out.addPage(p);
  }
  return Buffer.from(await out.save());
}
