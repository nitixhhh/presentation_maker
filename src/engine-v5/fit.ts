/**
 * Engine v5 — deterministic AUTO-FIT, in the real browser. For one slide: shrink the title scale (--ts) until the
 * title fits its line budget, then binary-search the largest body scale (--s) at which nothing overflows its box
 * (cards, panels, rows, the body, the canvas). Few words → bigger type that fills the slide; many words → smaller type,
 * never below the CSS floors (20px body / 18px labels). The found scales are baked into the stored HTML, so preview,
 * PDF and PPTX all render the same thing. Overflow that survives the floor is reported back for the engine to trim.
 */
import path from "path";
import type { Deck } from "../engine-v3/types";
import { openSlide, closePage } from "../engine-v3/render/browser";
import { slideDocument } from "../engine-v3/render/document";

export interface FitResult {
  html: string;
  s: number;
  ts: number;
  overflow: { where: string; px: number }[];
  /** share of the body's height the content occupies (0..1) — low = slide looks empty */
  fill: number;
  /** panels / cards with a large empty band inside (share of their height) */
  holes: { where: string; gap: number }[];
  screenshot?: Buffer;
}

export const FIT_JS = String.raw`(function(){
  var root = document.querySelector('.slide .v5');
  if (!root) return { skip: true };
  var R = root.getBoundingClientRect();
  function setS(v){ root.style.setProperty('--s', v.toFixed(3)); }
  function setT(v){ root.style.setProperty('--ts', v.toFixed(3)); }
  var sel = '[data-fit-box], .v5-card, .v5-panel, .v5-body, .v5-tl-item, .v5-rows, .v5-row';
  function problems(){
    var out = [];
    root.querySelectorAll(sel).forEach(function(b){
      if (b.closest('.v5-decor')) return;
      var dy = b.scrollHeight - b.clientHeight, dx = b.scrollWidth - b.clientWidth;
      if (dy > 2) out.push({ where: (b.className || b.tagName).toString().split(' ').slice(0,2).join('.'), px: dy });
      if (dx > 2 && !/v5-hub-card/.test(b.className)) out.push({ where: (b.className || b.tagName).toString().split(' ').slice(0,2).join('.') + ':x', px: dx });
    });
    root.querySelectorAll('h1,h2,h3,p,li,td,th,.v5-person,.v5-chip').forEach(function(el){
      if (el.closest('[data-v5-chrome]') || el.closest('.v5-decor') || el.closest('figure')) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.bottom > R.bottom - 34 || r.right > R.right - 20 || r.top < R.top + 10) out.push({ where: 'canvas:' + el.tagName, px: Math.round(Math.max(r.bottom - (R.bottom - 34), r.right - (R.right - 20))) });
    });
    // a hub card's own text never runs past the card's edge (the card itself is skipped above for its connector)
    root.querySelectorAll('.v5-hub-card h3, .v5-hub-card p').forEach(function(el){
      var card = el.closest('.v5-hub-card'); if (!card) return;
      var dx2 = Math.max(el.scrollWidth - el.clientWidth, el.getBoundingClientRect().right - (card.getBoundingClientRect().right - 8));
      if (dx2 > 1) out.push({ where: 'hub-text:x', px: Math.round(dx2) });
    });
    // text that sticks out of its own container (overflow at the top is invisible to scrollHeight)
    root.querySelectorAll('.v5-body h3, .v5-body p, .v5-body li, .v5-body td').forEach(function(el){
      if (el.closest('figure') || el.closest('[data-v5-chrome]')) return;
      var box = el.parentElement && el.parentElement.closest('.v5-row, .v5-card, .v5-panel, .v5-tl-item, .v5-body');
      if (!box) return;
      var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (!r.height) return;
      var d = Math.max(b.top - r.top, r.bottom - b.bottom, r.right - b.right - 1);
      if (d > 2) out.push({ where: 'outside:' + (box.className || '').toString().split(' ')[0], px: Math.round(d) });
    });
    // absolutely placed nodes (cycle): inside their container and never on top of each other
    var nodes = Array.prototype.slice.call(root.querySelectorAll('[data-fit-pos]'));
    nodes.forEach(function(nd, i){
      var r = nd.getBoundingClientRect(), c = nd.parentElement.getBoundingClientRect();
      var d = Math.max(c.top - r.top, r.bottom - c.bottom, c.left - r.left, r.right - c.right);
      if (d > 2) out.push({ where: 'node-outside', px: Math.round(d) });
      for (var j = i + 1; j < nodes.length; j++) { var q = nodes[j].getBoundingClientRect(); var ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (ox > 4 && oy > 4) out.push({ where: 'node-overlap', px: Math.round(Math.min(ox, oy)) }); }
    });
    return out;
  }
  // 1. titles: at most 2 lines (hero titles 3), shrink to 62 %
  var ts = 1;
  var titles = Array.prototype.slice.call(root.querySelectorAll('[data-fit-title]'));
  function titleLines(){ var m = 0; titles.forEach(function(t){ var lh = parseFloat(getComputedStyle(t).lineHeight) || 1; var max = /hero|quote/.test(t.className) ? 3 : 2; m = Math.max(m, t.getBoundingClientRect().height / lh / max); }); return m; }
  while (titles.length && titleLines() > 1.05 && ts > 0.62) { ts -= 0.04; setT(ts); }
  // 2. body: the largest scale in [lo, hi] with no problems
  var lo = 0.8, hi = parseFloat(root.getAttribute('data-max-s') || '1.5');
  setS(hi);
  var best = hi;
  if (problems().length) {
    setS(lo);
    if (problems().length) { best = lo; }
    else {
      var a = lo, b = hi;
      for (var i = 0; i < 8; i++) { var mid = (a + b) / 2; setS(mid); if (problems().length) b = mid; else a = mid; }
      best = a;
    }
  }
  setS(best);
  // a title that grew back after the body moved
  while (titles.length && titleLines() > 1.05 && ts > 0.62) { ts -= 0.04; setT(ts); }
  // still overflowing at the smallest body type (a title slide with many presenter fields): shrink the title too
  while (titles.length && best <= lo && problems().length && ts > 0.6) { ts -= 0.05; setT(ts); }
  var probs = problems();
  // fill: how much of the body the content uses
  var body = root.querySelector('.v5-body'), fill = 1;
  if (body) {
    var br = body.getBoundingClientRect(), bottom = br.top;
    body.querySelectorAll('h3,p,li,td,figure,img,.v5-card,.v5-panel').forEach(function(e){ var r = e.getBoundingClientRect(); if (r.height) bottom = Math.max(bottom, r.bottom); });
    fill = br.height ? Math.min(1, (bottom - br.top) / br.height) : 1;
  }
  // holes: a tall panel / card whose content leaves a big empty band (the panel counts as "filled" for the body
  // measure above, so an empty sidebar or a half-empty card needs its own check)
  var holes = [];
  root.querySelectorAll('.v5-panel, .v5-card').forEach(function(b){
    if (b.closest('.v5-decor') || b.closest('[data-v5-chrome]') || b.hasAttribute('data-no-hole')) return;
    var br = b.getBoundingClientRect();
    if (br.height < 220 || br.width < 160) return;
    var cs = getComputedStyle(b), top = br.top + parseFloat(cs.paddingTop), bot = br.bottom - parseFloat(cs.paddingBottom);
    var inner = bot - top; if (inner < 120) return;
    var spans = [];
    b.querySelectorAll('h1,h2,h3,p,li,td,img,svg,figure,.v5-chip,.v5-bignum,[data-icon],i').forEach(function(e){
      if (getComputedStyle(e).position === 'absolute' && e.tagName === 'IMG') return;
      var r = e.getBoundingClientRect(); if (r.height < 4 || r.width < 4) return;
      spans.push([Math.max(top, r.top), Math.min(bot, r.bottom)]);
    });
    if (!spans.length) { holes.push({ where: (b.className || '').toString().split(' ').slice(0,2).join('.'), gap: 1 }); return; }
    spans.sort(function(a, c){ return a[0] - c[0]; });
    var gap = 0, cur = top;
    spans.forEach(function(sp){ if (sp[0] > cur) gap = Math.max(gap, sp[0] - cur); cur = Math.max(cur, sp[1]); });
    gap = Math.max(gap, bot - cur);
    var g = gap / inner;
    if (g > 0.4 && gap > 140) holes.push({ where: (b.className || '').toString().split(' ').slice(0,2).join('.'), gap: Math.round(g * 100) / 100 });
  });
  return { s: Math.round(best * 1000) / 1000, ts: Math.round(ts * 1000) / 1000, overflow: probs.slice(0, 8), fill: Math.round(fill * 100) / 100, holes: holes.slice(0, 6) };
})()`;

/** put the fitted scales into the stored HTML (the root's inline style) */
export function bakeScales(html: string, s: number, ts: number): string {
  return html.replace(/(<div class="v5[^"]*"[^>]*?style=")--s:[\d.]+;--ts:[\d.]+/, `$1--s:${s};--ts:${ts}`);
}

export async function fitSlide(deck: Pick<Deck, "assets" | "design"> & { engine?: string; outline?: any }, n: number, html: string, renderDir: string, opts: { shot?: boolean } = {}): Promise<FitResult> {
  const doc = slideDocument(deck.design, html, { assetBase: "../assets/", deck: deck as any, n });
  const page = await openSlide(doc, path.join(renderDir), `fit-${String(n).padStart(2, "0")}`, 1);
  try {
    const r: any = await page.evaluate(FIT_JS);
    if (r?.skip) return { html, s: 1, ts: 1, overflow: [], fill: 1, holes: [] };
    const baked = bakeScales(html, r.s, r.ts);
    let screenshot: Buffer | undefined;
    if (opts.shot) {
      // re-render from the baked HTML so the diagrams draw at the final size
      await closePage(page);
      const p2 = await openSlide(slideDocument(deck.design, baked, { assetBase: "../assets/", deck: deck as any, n }), renderDir, `fit-${String(n).padStart(2, "0")}b`, 1);
      try {
        screenshot = await p2.screenshot({ type: "jpeg", quality: 82 });
      } finally {
        await closePage(p2);
      }
      return { html: baked, s: r.s, ts: r.ts, overflow: r.overflow || [], fill: r.fill ?? 1, holes: r.holes || [], screenshot };
    }
    return { html: baked, s: r.s, ts: r.ts, overflow: r.overflow || [], fill: r.fill ?? 1, holes: r.holes || [] };
  } finally {
    await closePage(page).catch(() => {});
  }
}
