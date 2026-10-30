/**
 * Engine v3 — PPTX export from the rendered DOM (layered, faithful, editable).
 *
 * For every slide Chromium renders the same HTML as the preview/PDF, then:
 *  1. text blocks → native editable PowerPoint text boxes at the measured position, line breaks as rendered,
 *     runs with font / size / weight / colour / letter-spacing / superscript;
 *  2. photos that nothing decorative covers → native pictures, pre-cropped exactly as object-fit showed them
 *     (rounded corners baked into a PNG when the design rounded them);
 *  3. everything PowerPoint cannot express (gradients, blend modes, masks, clip-paths, filters, SVG diagrams,
 *     shadows, decorative shapes) → a 2× background plate rendered with (1) and (2) hidden.
 * Result: the PPTX looks like the PDF and every word stays editable.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import PptxGenJS from "pptxgenjs";
import { openSlide, closePage, pool } from "../render/browser";
import { slideDocument } from "../render/document";
import { MEASURE_JS, HIDE_JS } from "../render/domScripts";
import { deckDir } from "../store";
import type { Deck } from "../types";

const PX = 1 / 96; // inches per px
const PT = 0.75; // points per px

interface SlideLayers {
  plate: Buffer;
  texts: any[];
  pictures: { data: string; x: number; y: number; w: number; h: number; transparency?: number }[];
}

/** Approximate average glyph width (em) — used to keep line lengths when an Office twin font is wider than the web font. */
const AVG_W: Record<string, number> = {
  "poppins": 0.56, "inter": 0.52, "playfair display": 0.47, "source sans 3": 0.45, "merriweather": 0.56, "open sans": 0.51,
  "space grotesk": 0.51, "ibm plex sans": 0.5, "montserrat": 0.57, "lato": 0.48, "lora": 0.5, "oswald": 0.4, "roboto": 0.49,
  "dm serif display": 0.48, "dm sans": 0.5, "mukta": 0.5, "noto sans devanagari": 0.55, "noto serif devanagari": 0.56, "hind": 0.5,
  "century gothic": 0.56, "calibri": 0.45, "georgia": 0.53, "segoe ui": 0.5, "segoe ui semibold": 0.51, "cambria": 0.49,
  "franklin gothic medium": 0.47, "nirmala ui": 0.54, "consolas": 0.55,
};
function widthScale(webFamily: string, pptxFont: string): number {
  const a = AVG_W[String(webFamily).split(",")[0].replace(/["']/g, "").trim().toLowerCase()];
  const b = AVG_W[pptxFont.toLowerCase()];
  if (!a || !b || b <= a * 1.02) return 1;
  return Math.max(0.85, a / b);
}

function mapFont(family: string, deck: Deck): string {
  const first = String(family || "").split(",")[0].replace(/["']/g, "").trim();
  const f = deck.design.font;
  if (process.env.PPTX_FONT_MODE === "web") return first || f.body;
  if (first === f.heading) return f.pptxHeading;
  if (first === f.body) return f.pptxBody;
  if (/devanagari|mukta|hind/i.test(first)) return "Nirmala UI";
  if (/mono|courier|consolas/i.test(first)) return "Consolas";
  if (/serif|georgia|times|playfair|merriweather|lora/i.test(first) && !/sans/i.test(first)) return "Georgia";
  return f.pptxBody;
}

async function roundedPng(buf: Buffer, w: number, h: number, r: number): Promise<Buffer> {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  return sharp(buf).resize(w, h).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function captureLayers(deck: Deck, s: Deck["slides"][number], renderDir: string): Promise<SlideLayers> {
  const doc = slideDocument(deck.design, s.html, { assetBase: "../assets/", deck, n: s.n });
  const page = await openSlide(doc, renderDir, `pptx-${String(s.n).padStart(2, "0")}`, 2);
  try {
    const m: any = await page.evaluate(MEASURE_JS);
    const texts = m.texts.filter((t: any) => t.native);
    const imgs = m.images.filter((i: any) => i.native);
    const pictures: SlideLayers["pictures"] = [];
    const keptImgs: string[] = [];
    for (const im of imgs) {
      try {
        let file = "";
        if (im.src.startsWith("file:")) file = fileURLToPath(im.src);
        if (!file || !fs.existsSync(/*turbopackIgnore: true*/ file)) continue;
        const left = Math.max(0, Math.round(im.crop.x)), top = Math.max(0, Math.round(im.crop.y));
        const width = Math.max(1, Math.min(im.naturalW - left, Math.round(im.crop.w)));
        const height = Math.max(1, Math.min(im.naturalH - top, Math.round(im.crop.h)));
        let buf: Buffer = await sharp(file).extract({ left, top, width, height }).toBuffer();
        let mime = "image/jpeg";
        if (im.radius > 0.5) {
          const outW = Math.round(im.w * 2), outH = Math.round(im.h * 2);
          buf = await roundedPng(buf, outW, outH, Math.min(im.radius * 2, Math.min(outW, outH) / 2));
          mime = "image/png";
        } else {
          buf = await sharp(buf).resize({ width: Math.min(width, Math.round(im.w * 2)), withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
        }
        pictures.push({ data: `${mime};base64,${buf.toString("base64")}`, x: im.x * PX, y: im.y * PX, w: im.w * PX, h: im.h * PX, transparency: im.opacity < 0.98 ? Math.round((1 - im.opacity) * 100) : undefined });
        keptImgs.push(im.id);
      } catch {
        /* falls back to plate */
      }
    }
    await page.evaluate(`(${HIDE_JS})(${JSON.stringify({ texts: texts.map((t: any) => t.id), images: keptImgs })})`);
    await page.waitForTimeout(60);
    const plate = await page.screenshot({ type: "jpeg", quality: 90 });
    // Semi-transparent text is pre-blended with the pixels under it (some viewers, e.g. LibreOffice, clip transparent text).
    const needsBlend = texts.filter((t: any) => (t.opacity ?? 1) < 0.98 || t.lines.some((l: any[]) => l.some((r) => (r.s.alpha ?? 1) < 0.98)));
    if (needsBlend.length) {
      const { data, info } = await sharp(plate).resize(1280, 720).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const t of needsBlend) {
        let r = 0, g = 0, b = 0, c = 0;
        for (let y = Math.max(0, Math.floor(t.y)); y < Math.min(720, t.y + t.h); y += 3)
          for (let x = Math.max(0, Math.floor(t.x)); x < Math.min(1280, t.x + t.w); x += 3) {
            const i = (y * info.width + x) * 3;
            r += data[i]; g += data[i + 1]; b += data[i + 2]; c++;
          }
        if (!c) continue;
        t.bg = [r / c, g / c, b / c];
      }
    }
    return { plate, texts, pictures };
  } finally {
    await closePage(page);
  }
}

function addTextBlock(slide: any, t: any, deck: Deck) {
  const lh = t.lineHeight || t.fontSize * 1.2;
  const firstTop = t.lineTops?.[0] ?? t.y;
  // CSS puts half-leading above the glyph box; PowerPoint (exact spacing) starts the line box at the top inset.
  const glyphH = t.fontSize * 1.15;
  const y = Math.max(0, firstTop - Math.max(0, (lh - glyphH) / 2));
  const nLines = t.lines.length;
  const h = Math.max(t.h, nLines * lh) + lh * 0.35;
  // width slack so a slightly wider Office font never re-wraps the measured lines
  // single lines get generous room (a wider Office font must not push a word onto a new line)
  const slack = nLines === 1 ? Math.max(24, t.w * 0.3) : Math.max(10, t.w * 0.12);
  let x = t.x, w = t.w + slack;
  const align = t.align === "center" ? "center" : t.align === "right" || t.align === "end" ? "right" : t.align === "justify" ? "left" : "left";
  if (align === "center") x = t.x - slack / 2;
  if (align === "right") x = t.x - slack;
  x = Math.max(0, x);
  w = Math.min(w, 1280 - x);

  const runs: any[] = [];
  t.lines.forEach((line: any[], li: number) => {
    line.forEach((r: any, ri: number) => {
      const st = r.s;
      const face = mapFont(st.font, deck);
      const k = process.env.PPTX_FONT_MODE === "web" ? 1 : widthScale(st.font, face);
      const opts: any = {
        fontFace: face,
        fontSize: Math.max(6, +(st.size * PT * k * (st.sup || st.sub ? 1 / 0.7 : 1)).toFixed(1)),
        color: st.color,
        bold: st.weight >= 600,
        italic: !!st.italic,
      };
      if (st.sup) { opts.superscript = true; }
      if (st.sub) { opts.subscript = true; }
      if (st.underline) opts.underline = { style: "sng" };
      if (st.strike) opts.strike = "sngStrike";
      if (st.spacing) opts.charSpacing = +(st.spacing * PT).toFixed(2);
      const a = (st.alpha ?? 1) * (t.opacity ?? 1);
      if (a < 0.98) {
        if (t.bg) {
          const fg = [0, 2, 4].map((i) => parseInt(String(st.color).slice(i, i + 2), 16));
          opts.color = fg.map((v, i) => Math.round(a * v + (1 - a) * t.bg[i]).toString(16).padStart(2, "0")).join("").toUpperCase();
        } else opts.transparency = Math.round((1 - a) * 100);
      }
      if (ri === line.length - 1 && li < t.lines.length - 1) opts.breakLine = true;
      runs.push({ text: r.t, options: opts });
    });
  });
  slide.addText(runs, {
    x: x * PX,
    y: y * PX,
    w: w * PX,
    h: h * PX,
    margin: 0,
    align,
    valign: "top",
    lineSpacing: +(lh * PT).toFixed(1),
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    wrap: true,
    fit: "none",
    isTextBox: true,
  });
}

export async function exportPptx(deck: Deck): Promise<Buffer> {
  const renderDir = path.join(deckDir(deck.id), "render");
  const layers = await pool(deck.slides, 3, (s) => captureLayers(deck, s, renderDir));
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 × 7.5 in = 1280 × 720 px
  pptx.title = deck.brief.title;
  pptx.company = "DeckCraft AI";
  pptx.theme = { headFontFace: deck.design.font.pptxHeading, bodyFontFace: deck.design.font.pptxBody };

  deck.slides.forEach((s, i) => {
    const L = layers[i];
    const slide = pptx.addSlide();
    slide.background = { data: `image/jpeg;base64,${L.plate.toString("base64")}` };
    for (const p of L.pictures) slide.addImage({ data: p.data, x: p.x, y: p.y, w: p.w, h: p.h, transparency: p.transparency });
    for (const t of L.texts) addTextBlock(slide, t, deck);
    const credits = deck.assets.filter((a) => a.forSlides.includes(s.n) && a.credit).map((a) => `Image: ${a.credit}${a.sourceUrl ? ` (${a.sourceUrl})` : ""}`);
    const notes = [s.notes, ...credits].filter(Boolean).join("\n\n");
    if (notes) slide.addNotes(notes);
  });
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
