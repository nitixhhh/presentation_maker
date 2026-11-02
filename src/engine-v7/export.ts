/** Engine v7 — exports: vector PDF printed by Chromium (one page per slide), PPTX with one full-slide picture per slide + notes. */
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import { pdfPage } from "./render";
import type { V7Deck } from "./types";

export async function exportPdf(deck: V7Deck, title: string): Promise<Buffer> {
  const out = await PDFDocument.create();
  out.setTitle(title);
  out.setCreator("DeckCraft AI — Engine v7");
  for (const r of deck.results) {
    const file = path.join(deck.dir, `final-${String(r.n).padStart(2, "0")}.html`);
    const buf = await pdfPage(file); // one at a time: low memory
    const src = await PDFDocument.load(buf);
    const [p] = await out.copyPages(src, [0]);
    out.addPage(p);
  }
  return Buffer.from(await out.save());
}

export async function exportPptx(deck: V7Deck, title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "V7", width: 13.333, height: 7.5 });
  pptx.layout = "V7";
  pptx.title = title;
  for (const r of deck.results) {
    const s = deck.slides.find((x) => x.n === r.n)!;
    const slide = pptx.addSlide();
    const data = "data:image/png;base64," + fs.readFileSync(r.png).toString("base64");
    slide.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
    const refs = s.n === deck.slides.length && deck.references.length ? "\n\nReferences:\n" + deck.references.map((x) => `[${x.n}] ${x.text} ${x.url}`).join("\n") : "";
    slide.addNotes(`${s.title}\n${s.body}\n\n${s.notes}${refs}`.trim());
  }
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buf;
}
