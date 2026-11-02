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
}

/** In-page measurements: text outside the canvas or the safe margin, text overflowing its box, tiny text, text boxes overlapping each other. */
const MEASURE = `(() => {
  const W = ${W}, H = ${H}, M = 24;
  const issues = [];
  const desc = (el) => { const t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 48); return '<' + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? ' class="' + el.className.split(' ')[0] + '"' : '') + '> "' + t + '"'; };
  const all = [...document.body.querySelectorAll('*')].filter(el => !(el.closest('svg') && el.tagName.toLowerCase() !== 'svg' && el.tagName.toLowerCase() !== 'text'));
  const textEls = [];
  let chars = 0;
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    const isSvgText = el.tagName.toLowerCase() === 'text' || el.tagName.toLowerCase() === 'tspan';
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const t = el.textContent.trim();
    chars += t.length;
    textEls.push({ el, r, t });
    const fs = parseFloat(cs.fontSize) * (isSvgText ? (el.ownerSVGElement ? (el.ownerSVGElement.getBoundingClientRect().width / (el.ownerSVGElement.viewBox?.baseVal?.width || el.ownerSVGElement.getBoundingClientRect().width)) : 1) : 1);
    if (fs < 23 && t.length > 2) issues.push('text too small (' + Math.round(fs) + 'px): ' + desc(el));
    if (r.left < M || r.top < M || r.right > W - M || r.bottom > H - M) {
      const out = r.left < 0 || r.top < 0 || r.right > W || r.bottom > H;
      issues.push((out ? 'text is cut off by the slide edge: ' : 'text touches the slide edge (less than 24px margin): ') + desc(el) + ' box ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    }
    if (!isSvgText) {
      if (el.scrollHeight > el.clientHeight + 4 && ['hidden','clip'].includes(cs.overflowY)) issues.push('text overflows its box and is clipped (' + (el.scrollHeight - el.clientHeight) + 'px hidden): ' + desc(el));
      if (el.scrollWidth > el.clientWidth + 4 && ['hidden','clip'].includes(cs.overflowX)) issues.push('text is wider than its box and clipped: ' + desc(el));
    }
  }
  // ancestors that clip their text children
  for (const { el, r } of textEls) {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== 'visible') {
        const pr = p.getBoundingClientRect();
        if (r.bottom > pr.bottom + 4 || r.right > pr.right + 4 || r.top < pr.top - 4 || r.left < pr.left - 4) { issues.push('text is cut off by its container: ' + desc(el)); break; }
      }
      p = p.parentElement;
    }
  }
  // overlapping text boxes (different elements, neither contains the other)
  const ov = [];
  for (let i = 0; i < textEls.length; i++) for (let j = i + 1; j < textEls.length; j++) {
    const a = textEls[i], b = textEls[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 8 && y > 8 && x * y > 0.15 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) ov.push('text overlaps other text: ' + desc(a.el) + ' and ' + desc(b.el));
  }
  issues.push(...ov.slice(0, 4));
  const imgs = [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => 'image failed to load: ' + i.getAttribute('src'));
  issues.push(...imgs);
  return { issues: [...new Set(issues)].slice(0, 14), textChars: chars };
})()`;

export async function renderSlide(doc: string, dir: string, name: string): Promise<{ png: string; jpg: Buffer; report: DomReport; file: string }> {
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
    const report = (await page.evaluate(MEASURE).catch((e: any) => ({ issues: [`measure failed: ${String(e).slice(0, 80)}`], textChars: 0 }))) as DomReport;
    const pngBuf = await page.screenshot({ type: "png" });
    const png = path.join(dir, `${name}.png`);
    fs.writeFileSync(png, pngBuf);
    const jpg = await page.screenshot({ type: "jpeg", quality: 80, scale: "css", clip: { x: 0, y: 0, width: W, height: H } });
    return { png, jpg, report, file };
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
