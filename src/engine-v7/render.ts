/**
 * Engine v7 — render one slide document in headless Chromium at 1920x1080 and measure it. Network is closed except
 * the deck's own files and Google's font files, so a slide can never depend on a random hotlinked asset.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { getBrowser } from "../engine-v3/render/browser";

export const W = 1920;
export const H = 1080;

const GUARD = `<style id="v7-guard">html,body{margin:0!important;padding:0;width:${W}px!important;height:${H}px!important;overflow:hidden!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:${W}px ${H}px;margin:0}</style>`;

/** Puts the deck's @font-face CSS and the canvas guard into the slide's <head>; strips scripts and external links. */
export function finalDocument(html: string, fontCss: string): string {
  let doc = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi, "")
    .replace(/@import\s+url\([^)]*fonts\.googleapis[^)]*\)\s*;?/gi, "");
  const inject = `<style id="v7-fonts">${fontCss}</style>${GUARD}`;
  if (/<\/head>/i.test(doc)) doc = doc.replace(/<\/head>/i, `${inject}</head>`);
  else doc = doc.replace(/<body/i, `<head>${inject}</head><body`);
  // guard must win over the slide's own html/body rules: move it to the very end of head
  return doc;
}

export interface DomReport {
  issues: string[];
  textChars: number;
  /** short texts sitting in the top/bottom band (running headers/footers are compared across slides) */
  edgeTexts?: string[];
  /** share of the canvas covered by drawn graphics (svg drawings, pictures) */
  graphicShare?: number;
}

/** Smallest font the engine accepts anywhere on a slide (px at 1920x1080). Anything smaller is a hard failure. */
export const MIN_FONT_PX = Number(process.env.V7_MIN_FONT || 22);

/**
 * In-page measurements (all are HARD failures unless noted): text outside the canvas or the safe margin, text overflowing
 * or clipped by its box, text under MIN_FONT_PX, text boxes overlapping each other, diagram parts or labels cut off by
 * their SVG drawing area or the slide edge, empty bordered boxes, broken images, "roughen" filters that make lines wobbly.
 */
const MEASURE = `(() => {
  const W = ${W}, H = ${H}, M = 24, MIN = ${MIN_FONT_PX};
  const issues = [];
  const desc = (el) => { const t = (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 48); const c = el.getAttribute && el.getAttribute('class'); return '<' + el.tagName.toLowerCase() + (c ? ' class="' + c.split(' ')[0] + '"' : '') + '> "' + t + '"'; };
  const visible = (el) => { const cs = getComputedStyle(el); return !(cs.display === 'none' || cs.visibility === 'hidden'); };
  const opacityOf = (el) => { let o = 1; for (let p = el; p && p.nodeType === 1; p = p.parentElement || p.parentNode) { const cs = getComputedStyle(p); o *= Number(cs.opacity); if (p === document.body) break; } return o; };
  const svgScale = (el) => { const s = el.ownerSVGElement; if (!s) return 1; const ctm = el.getScreenCTM ? el.getScreenCTM() : null; return ctm ? Math.sqrt(Math.abs(ctm.a * ctm.d - ctm.b * ctm.c)) : 1; };
  const textEls = [];
  const edgeTexts = [];
  let chars = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const tag = el.tagName.toLowerCase();
    const isSvgText = tag === 'text' || tag === 'tspan' || tag === 'textpath';
    // the box of the glyphs themselves (an element's padding is not its text): union of its own text nodes' rects
    let r = el.getBoundingClientRect();
    if (!isSvgText) {
      let L = Infinity, T = Infinity, Rr = -Infinity, B = -Infinity;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) { if (q.width < 1 || q.height < 1) continue; L = Math.min(L, q.left); T = Math.min(T, q.top); Rr = Math.max(Rr, q.right); B = Math.max(B, q.bottom); }
      }
      if (L < Infinity) r = { left: L, top: T, right: Rr, bottom: B, width: Rr - L, height: B - T };
    }
    if (r.width === 0 || r.height === 0) continue;
    const t = el.textContent.trim();
    const op = opacityOf(el);
    chars += t.length;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) * (isSvgText ? svgScale(el) : 1);
    textEls.push({ el, r, t, op, fs });
    if ((r.top < 140 || r.bottom > H - 140) && fs < 44 && t.length > 1 && t.length < 90) edgeTexts.push(t.replace(/\\s+/g, ' '));
    if (op < 0.3) continue; // a faint decorative glyph is not reading text
    if (fs < MIN - 0.5 && t.length > 1) issues.push('text too small (' + Math.round(fs) + 'px, the minimum is ' + MIN + 'px): ' + desc(el));
    if (r.left < M || r.top < M || r.right > W - M || r.bottom > H - M) {
      const out = r.left < 0 || r.top < 0 || r.right > W || r.bottom > H;
      issues.push((out ? 'text is cut off by the slide edge: ' : 'text touches the slide edge (less than 24px margin): ') + desc(el) + ' box ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    }
    if (!isSvgText) {
      if (el.scrollHeight > el.clientHeight + 4 && ['hidden','clip'].includes(cs.overflowY)) issues.push('text overflows its box and is clipped (' + (el.scrollHeight - el.clientHeight) + 'px hidden): ' + desc(el));
      if (el.scrollWidth > el.clientWidth + 4 && ['hidden','clip'].includes(cs.overflowX)) issues.push('text is wider than its box and clipped: ' + desc(el));
    } else {
      // a label outside its own drawing area is cut off by the svg viewport
      let s = el.ownerSVGElement; while (s && s.ownerSVGElement) s = s.ownerSVGElement;
      if (s) { const sr = s.getBoundingClientRect(); const so = getComputedStyle(s).overflow; if (so !== 'visible' && (r.left < sr.left - 3 || r.right > sr.right + 3 || r.top < sr.top - 3 || r.bottom > sr.bottom + 3)) issues.push('diagram label is cut off by its drawing area (enlarge the svg viewBox or move the label inside): ' + desc(el)); }
    }
  }
  // text spilling out of its own coloured/bordered box (a pill, tag or card whose text is wider than the box)
  for (const { el, r, op } of textEls) {
    if (op < 0.3) continue;
    if (el.ownerSVGElement) {
      // svg label sitting on an svg rect: the rect behind it must hold it
      const s = el.ownerSVGElement;
      const cy = (r.top + r.bottom) / 2, cx = (r.left + r.right) / 2;
      for (const box of s.querySelectorAll('rect')) {
        if (box.closest('defs,clipPath,mask,pattern,symbol,marker')) continue;
        const b = box.getBoundingClientRect();
        if (b.width >= s.getBoundingClientRect().width * 0.9) continue;
        if (cy < b.top || cy > b.bottom || cx < b.left || cx > b.right) continue;
        if (b.height > r.height * 3.5 || b.width > r.width * 3) continue; // a panel, not a label box
        if (r.left < b.left - 4 || r.right > b.right + 4) { issues.push('label text is wider than the box drawn behind it: ' + desc(el)); break; }
      }
      continue;
    }
    const cs = getComputedStyle(el);
    const hasBox = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || ['Top','Right','Bottom','Left'].filter(k => parseFloat(cs['border' + k + 'Width']) >= 1).length >= 3;
    if (!hasBox) continue;
    const b = el.getBoundingClientRect();
    const fsz = parseFloat(cs.fontSize) || 16, tol = Math.max(6, fsz * 0.35);
    if (r.left < b.left - 4 || r.right > b.right + 4 || r.top < b.top - tol || r.bottom > b.bottom + tol) issues.push('text spills out of its box: ' + desc(el));
  }
  // boxes (cards, panels, tags) that carry text but run off the slide
  for (const el of document.body.querySelectorAll('div,section,article,aside,figure,p,li')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const boxed = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || ['Top','Right','Bottom','Left'].filter(k => parseFloat(cs['border' + k + 'Width']) >= 1).length >= 2;
    if (!boxed || !(el.textContent || '').trim()) continue;
    const b = el.getBoundingClientRect();
    if (b.width >= W * 0.9 || b.height >= H * 0.9) continue;
    if (b.left < -4 || b.top < -4 || b.right > W + 4 || b.bottom > H + 4) issues.push('a text box runs off the slide edge (box ' + [b.left, b.top, b.right, b.bottom].map(Math.round).join(',') + '): ' + desc(el));
  }
  // ancestors that clip their text children
  for (const { el, r, op } of textEls) {
    if (op < 0.3) continue;
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== 'visible' && p.tagName.toLowerCase() !== 'svg' && !p.ownerSVGElement) {
        const pr = p.getBoundingClientRect();
        if (r.bottom > pr.bottom + 4 || r.right > pr.right + 4 || r.top < pr.top - 4 || r.left < pr.left - 4) { issues.push('text is cut off by its container: ' + desc(el)); break; }
      }
      p = p.parentElement;
    }
  }
  // overlapping text boxes (different elements, neither contains the other; faint decorative text is ignored)
  const ov = [];
  for (let i = 0; i < textEls.length; i++) for (let j = i + 1; j < textEls.length; j++) {
    const a = textEls[i], b = textEls[j];
    if (a.op < 0.3 || b.op < 0.3) continue;
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.t === b.t) continue; // the same word layered twice is a deliberate echo/shadow effect
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 5 && y > 5 && x * y > 0.06 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) ov.push('text overlaps other text: ' + desc(a.el) + ' and ' + desc(b.el));
  }
  issues.push(...ov.slice(0, 5));
  // diagrams: drawn parts outside the svg's own viewport or the slide (only drawings that carry labels = real diagrams)
  let graphic = 0;
  const outer = [...document.body.querySelectorAll('svg')].filter(s => !s.ownerSVGElement && visible(s));
  for (const s of outer) {
    const sr = s.getBoundingClientRect();
    if (sr.width < 4 || sr.height < 4) continue;
    const shapes = [...s.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text,image,use')].filter(e => !e.closest('defs,clipPath,mask,pattern,symbol,marker'));
    const full = sr.width >= W * 0.95 && sr.height >= H * 0.95;
    if (shapes.length >= 3 && !full) graphic += Math.max(0, Math.min(sr.right, W) - Math.max(sr.left, 0)) * Math.max(0, Math.min(sr.bottom, H) - Math.max(sr.top, 0));
    const hasText = !!s.querySelector('text');
    if (!hasText || full) continue;
    const clip = getComputedStyle(s).overflow !== 'visible';
    let cut = 0, edge = 0;
    for (const e of shapes) {
      if (e.tagName.toLowerCase() === 'text') continue;
      const er = e.getBoundingClientRect();
      if (er.width * er.height < 40 || er.width >= sr.width * 0.98 && er.height >= sr.height * 0.98) continue; // backdrops
      if (clip && (er.left < sr.left - 6 || er.right > sr.right + 6 || er.top < sr.top - 6 || er.bottom > sr.bottom + 6)) cut++;
      if (er.left < -2 || er.top < -2 || er.right > W + 2 || er.bottom > H + 2) edge++;
    }
    if (cut) issues.push('part of a diagram is cut off by its svg drawing area (' + cut + ' shapes reach outside the viewBox): enlarge the viewBox or shrink/move the drawing so every shape and label fits with 40px padding');
    if (edge) issues.push('part of a diagram is cut off by the slide edge (' + edge + ' shapes outside the 1920x1080 canvas)');
  }
  for (const im of document.images) {
    if (!visible(im)) continue;
    const r = im.getBoundingClientRect();
    graphic += Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
  }
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage.includes('url(')) { const r = el.getBoundingClientRect(); graphic += Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)); }
  }
  // empty bordered boxes: a frame with nothing inside reads as an unfinished placeholder
  for (const el of document.body.querySelectorAll('div,section,figure,article,aside,span')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < W * H * 0.025 || area > W * H * 0.7) continue;
    const bordered = ['Top','Right','Bottom','Left'].filter(k => parseFloat(cs['border' + k + 'Width']) >= 1 && cs['border' + k + 'Style'] !== 'none').length >= 3 || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1);
    if (!bordered || (cs.backgroundImage && cs.backgroundImage !== 'none')) continue;
    if (parseFloat(cs.borderTopLeftRadius) >= Math.min(r.width, r.height) * 0.35) continue; // rings/circles are a drawn motif, not a box
    if ((el.textContent || '').trim().length > 0 || el.querySelector('img,svg,canvas,video,picture')) continue;
    issues.push('an empty framed box with nothing inside (looks like a missing visual or placeholder): ' + desc(el) + ' box ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
  }
  if (document.querySelector('feTurbulence,feDisplacementMap,feturbulence,fedisplacementmap')) issues.push('a roughen/sketch filter (feTurbulence/feDisplacementMap) makes lines and letters wobbly — remove it and draw clean geometry');
  const imgs = [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => 'image failed to load: ' + i.getAttribute('src'));
  issues.push(...imgs);
  return { issues: [...new Set(issues)].slice(0, 16), textChars: chars, edgeTexts: [...new Set(edgeTexts)].slice(0, 12), graphicShare: Math.min(1, graphic / (W * H)) };
})()`;

/**
 * Deterministic repairs before anything is measured (no AI call): every reading text under MIN_FONT_PX is raised to the
 * floor (SVG text in its own user units), and text poking up to 90px past the safe margin is nudged back inside. Returns the patched designer document (engine-injected fonts/guard removed) or null.
 */
const FLOOR = `(() => {
  const MIN = ${MIN_FONT_PX};
  let n = 0;
  const opacityOf = (el) => { let o = 1; for (let p = el; p && p.nodeType === 1; p = p.parentElement || p.parentNode) { o *= Number(getComputedStyle(p).opacity); if (p === document.body) break; } return o; };
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 1);
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || opacityOf(el) < 0.3) continue;
    const tag = el.tagName.toLowerCase();
    const isSvg = !!el.ownerSVGElement;
    let scale = 1;
    if (isSvg && el.getScreenCTM) { const m = el.getScreenCTM(); if (m) scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }
    const px = parseFloat(cs.fontSize) * scale;
    if (!(px < MIN - 0.5)) continue;
    const want = MIN / scale;
    el.style.setProperty('font-size', want.toFixed(2) + 'px', 'important');
    n++;
  }
  // text that pokes a little past the safe margin (up to 90px) is moved back inside: a nudge, never a redesign
  const W = ${W}, H = ${H}, M = 28;
  const moved = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    if (el.ownerSVGElement || el.tagName.toLowerCase() === 'svg') continue;
    const own = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 1);
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || opacityOf(el) < 0.3) continue;
    let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
    for (const x of el.childNodes) { if (x.nodeType !== 3 || !x.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(x); for (const q of rg.getClientRects()) { if (q.width < 1) continue; L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); } }
    if (L === Infinity) continue;
    let dx = 0, dy = 0;
    if (L < M) dx = M - L; else if (R > W - M) dx = (W - M) - R;
    if (T < M) dy = M - T; else if (B > H - M) dy = (H - M) - B;
    if (!dx && !dy) continue;
    if (Math.abs(dx) > 90 || Math.abs(dy) > 90 || (R - L) > W - 2 * M || (B - T) > H - 2 * M) continue;
    if ([...moved].some(m => m.contains(el))) continue;
    const t = cs.transform && cs.transform !== 'none' ? cs.transform + ' ' : '';
    el.style.setProperty('transform', t + 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)', 'important');
    moved.add(el);
    n++;
  }
  if (!n) return null;
  const root = document.documentElement.cloneNode(true);
  root.querySelectorAll('#v7-fonts,#v7-guard').forEach(e => e.remove());
  return { count: n, html: '<!doctype html>\\n' + root.outerHTML };
})()`;

/** Largest empty (flat-colour) rectangle on the rendered slide, from the pixels: share of the canvas + its box. */
export async function emptyRegion(png: string): Promise<{ share: number; box: [number, number, number, number] }> {
  const sharp = (await import("sharp")).default;
  const GW = 48, GH = 27, CW = W / GW, CH = H / GH; // 40px cells
  const { data, info } = await sharp(png).resize(GW * 8, GH * 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const empty: number[][] = [];
  for (let gy = 0; gy < GH; gy++) {
    const row: number[] = [];
    for (let gx = 0; gx < GW; gx++) {
      let mn = 255, mx = 0, cmn = [255, 255, 255], cmx = [0, 0, 0];
      for (let y = gy * 8; y < gy * 8 + 8; y++) for (let x = gx * 8; x < gx * 8 + 8; x++) {
        const i = (y * info.width + x) * 3;
        const l = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        if (l < mn) mn = l; if (l > mx) mx = l;
        for (let c = 0; c < 3; c++) { if (data[i + c] < cmn[c]) cmn[c] = data[i + c]; if (data[i + c] > cmx[c]) cmx[c] = data[i + c]; }
      }
      row.push(mx - mn < 10 && Math.max(cmx[0] - cmn[0], cmx[1] - cmn[1], cmx[2] - cmn[2]) < 14 ? 1 : 0);
    }
    empty.push(row);
  }
  // maximal rectangle of empty cells (histogram method)
  const h = new Array(GW).fill(0);
  let best = { a: 0, x: 0, y: 0, w: 0, hh: 0 };
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) h[x] = empty[y][x] ? h[x] + 1 : 0;
    for (let x = 0; x < GW; x++) {
      let mh = Infinity;
      for (let x2 = x; x2 < GW && h[x2] > 0; x2++) {
        mh = Math.min(mh, h[x2]);
        const a = mh * (x2 - x + 1);
        if (a > best.a) best = { a, x, y: y - mh + 1, w: x2 - x + 1, hh: mh };
      }
    }
  }
  return { share: best.a / (GW * GH), box: [Math.round(best.x * CW), Math.round(best.y * CH), Math.round(best.w * CW), Math.round(best.hh * CH)] };
}

export async function renderSlide(doc: string, dir: string, name: string, opts: { floor?: boolean } = {}): Promise<{ png: string; jpg: Buffer; report: DomReport; file: string; floored?: { count: number; html: string } | null }> {
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, doc);
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("file:") || u.startsWith("data:") || /^https:\/\/fonts\.(gstatic|googleapis)\.com\//.test(u)) return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 45000 }).catch(() => {});
    await page.evaluate(async () => {
      await (document as any).fonts?.ready;
    }).catch(() => {});
    await page.waitForTimeout(250);
    let floored: { count: number; html: string } | null = null;
    if (opts.floor) {
      floored = (await page.evaluate(FLOOR).catch(() => null)) as any;
      if (floored) await page.waitForTimeout(120);
    }
    const report = (await page.evaluate(MEASURE).catch((e: any) => ({ issues: [`measure failed: ${String(e).slice(0, 80)}`], textChars: 0 }))) as DomReport;
    const pngBuf = await page.screenshot({ type: "png" });
    const png = path.join(dir, `${name}.png`);
    fs.writeFileSync(png, pngBuf);
    const jpg = await page.screenshot({ type: "jpeg", quality: 80, scale: "css", clip: { x: 0, y: 0, width: W, height: H } });
    return { png, jpg, report, file, floored };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Vector PDF page of an already-written slide document. */
export async function pdfPage(file: string): Promise<Buffer> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("file:") || u.startsWith("data:") || /^https:\/\/fonts\.(gstatic|googleapis)\.com\//.test(u)) return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 45000 }).catch(() => {});
    await page.evaluate(async () => { await (document as any).fonts?.ready; }).catch(() => {});
    await page.waitForTimeout(200);
    return await page.pdf({ width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: "1", preferCSSPageSize: true });
  } finally {
    await ctx.close().catch(() => {});
  }
}
