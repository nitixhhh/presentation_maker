/** Engine v3 — PNG render of every slide (thumbnails, sharing, QA evidence). */
import fs from "fs";
import path from "path";
import { openSlide, closePage, pool, renderLimit } from "../render/browser";
import { slideDocument } from "../render/document";
import { deckDir } from "../store";
import type { Deck } from "../types";

export async function renderPngs(deck: Deck, outDir: string, scale = 1): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const renderDir = path.join(deckDir(deck.id), "render");
  return pool(deck.slides, renderLimit(4), async (s) => {
    const page = await openSlide(slideDocument(deck.design, s.html, { assetBase: "../assets/", deck, n: s.n }), renderDir, `png-${String(s.n).padStart(2, "0")}`, scale);
    try {
      const file = path.join(outDir, `slide-${String(s.n).padStart(2, "0")}.png`);
      await page.screenshot({ path: file, type: "png" });
      return file;
    } finally {
      await closePage(page);
    }
  });
}
