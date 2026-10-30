/**
 * Speaker notes as a separate A4 PDF: for each slide a small picture of the slide, its title and the
 * notes written by the designer AI (what to say). Mechanical layout of a document, not slide design.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { getBrowser } from "../render/browser";
import { deckDir } from "../store";
import type { Deck } from "../types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function exportNotesPdf(deck: Deck): Promise<Buffer> {
  const dir = deckDir(deck.id);
  const titleOf = (n: number) => deck.outline.slides.find((s) => s.n === n)?.title || `Slide ${n}`;
  const hindi = deck.brief.language === "Hindi";
  const rows = deck.slides
    .map((s) => {
      const prev = path.join(dir, "previews", `slide-${String(s.n).padStart(2, "0")}.jpg`);
      const img = fs.existsSync(prev) ? `<img src="${pathToFileURL(prev).href}" alt="">` : `<div class="ph"></div>`;
      const notes = (s.notes || "").trim();
      const paras = notes ? notes.split(/\n{2,}|\n/).map((p) => `<p>${esc(p)}</p>`).join("") : `<p class="muted">${hindi ? "इस स्लाइड के लिए कोई नोट्स नहीं।" : "No notes for this slide."}</p>`;
      return `<section><div class="thumb">${img}<span>${s.n}</span></div><div class="txt"><h2>${esc(titleOf(s.n))}</h2>${paras}</div></section>`;
    })
    .join("");
  const p = deck.request.presenter;
  const html = `<!doctype html><html lang="${hindi ? "hi" : "en"}"><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm 14mm}
body{font-family:Inter,"Noto Sans","Noto Sans Devanagari",Arial,sans-serif;color:#1f2430;font-size:11.5pt;line-height:1.5;margin:0}
header{border-bottom:2px solid ${deck.design.palette?.primary || "#4f46e5"};padding-bottom:8px;margin-bottom:14px}
header h1{font-size:17pt;margin:0 0 2px}header div{color:#667085;font-size:10pt}
section{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid #e4e7ec;break-inside:avoid}
.thumb{position:relative;flex:0 0 62mm}.thumb img,.ph{width:62mm;height:34.9mm;object-fit:cover;border-radius:4px;border:1px solid #e4e7ec;display:block;background:#f2f4f7}
.thumb span{position:absolute;top:4px;left:4px;background:#111827cc;color:#fff;font-size:8.5pt;font-weight:700;padding:1px 6px;border-radius:3px}
.txt{flex:1}.txt h2{font-size:12.5pt;margin:0 0 4px}.txt p{margin:0 0 5px}.muted{color:#98a2b3}
</style></head><body><header><h1>${esc(deck.brief.title)}</h1><div>${hindi ? "वक्ता नोट्स" : "Speaker notes"}${p?.names ? ` · ${esc(p.names)}` : ""}${p?.institute ? ` · ${esc(p.institute)}` : ""}</div></header>${rows}</body></html>`;
  const renderDir = path.join(dir, "render");
  fs.mkdirSync(renderDir, { recursive: true });
  const file = path.join(renderDir, "notes.html");
  fs.writeFileSync(file, html);
  const browser = await getBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 45000 });
    await page.evaluate("document.fonts.ready");
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await ctx.close().catch(() => {});
  }
}
