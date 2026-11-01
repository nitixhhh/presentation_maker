/**
 * Engine v4 — last deterministic pass on every finished slide (after the agent, the v3 polish passes and the deck review):
 *  1. decorative numerals ("04" at 100px+) are removed — they collided with titles; real data keeps its unit/label;
 *  2. type floor: any text of 3+ words ≥ 20px, short labels ≥ 18px (citations, credits and source lines excepted);
 *  3. fill: when the content stops in the upper ~60% of the slide, the content block grows (taller cards, bigger
 *     type) until it reaches the lower part of the canvas.
 * Each step is re-measured; a step that creates a new layout problem (overflow, overlap, edge) is rolled back.
 */
import { openSlide, closePage } from "../engine-v3/render/browser";
import { slideDocument } from "../engine-v3/render/document";
import { MEASURE_JS, SERIALIZE_JS } from "../engine-v3/render/domScripts";
import { unresolve } from "../engine-v3/qa/inspect";
import type { Deck } from "../engine-v3/types";

const SKIP_TEXT = String.raw`/^\s*\[\d+([,–-]\s*\d+)*\]\s*$|(^|\s)(source|sources|credit|credits|photo|image|via|cc[ -]by|cc0|public domain|wikimedia|wikipedia|nasa|openverse|retrieved|©)\b|https?:|doi\.org|^\s*\d+\s*\/\s*\d+\s*$/i`;

/** removes lone decorative numerals; caps step numbers; also kills numeral ::before/::after decorations */
export const DECOR_JS = String.raw`(function(role){
var S = document.querySelector('section.slide'); var out = []; var cands = [];
var NUM = /^(no\.?\s*|#)?0?\d{1,2}[.)\/]?$/i;
S.querySelectorAll('*').forEach(function(el){
  if (el.closest('svg') || el.closest('figure.v3-diagram') || el.children.length) return;
  var t = (el.textContent || '').trim(); if (!NUM.test(t)) return;
  var fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 28) return;
  cands.push(el);
});
// a lone big numeral, or any numeral laid over the layout (absolute / faded), is decoration → removed;
// in-flow step numbers (01 02 03 in a process) stay, capped at 56px
function decorative(el){ var c = getComputedStyle(el); var p = el.parentElement ? getComputedStyle(el.parentElement) : null;
  var faded = parseFloat(c.opacity) < 0.6 || /rgba\([^)]*,\s*0?\.[0-5]\d*\)|\/\s*0?\.[0-5]\d*\s*\)|transparent/.test(c.color);
  return c.position === 'absolute' || c.position === 'fixed' || faded || (p && p.position === 'absolute' && el.parentElement.children.length === 1); }
var big = cands.filter(function(el){ return parseFloat(getComputedStyle(el).fontSize) >= 56; });
cands.forEach(function(el){ var fs0 = parseFloat(getComputedStyle(el).fontSize); if ((fs0 >= 56 && big.length === 1) || (decorative(el) && (fs0 >= 56 || getComputedStyle(el).position === 'absolute'))){ out.push('removed decorative "' + el.textContent.trim() + '" (' + Math.round(parseFloat(getComputedStyle(el).fontSize)) + 'px)'); el.remove(); }
  else if (parseFloat(getComputedStyle(el).fontSize) > 64){ el.style.setProperty('font-size', '56px', 'important'); out.push('step number capped at 56px'); } });
// icons / badges / decorative SVG lying on top of text (not part of the text's own card): removed
var SR = S.getBoundingClientRect();
var tx = []; S.querySelectorAll('*').forEach(function(el){ if (el.closest('svg')) return; var own = ''; el.childNodes.forEach(function(n){ if (n.nodeType === 3) own += n.textContent; }); if (!own.trim()) return; var cs0 = getComputedStyle(el); if (cs0.display === 'none' || cs0.visibility === 'hidden') return;
  var rg = document.createRange(); rg.selectNodeContents(el); var rr = rg.getBoundingClientRect(); if (rr.width > 4 && rr.height > 4) tx.push({el: el, r: rr}); });
S.querySelectorAll('svg, .ic, [data-icon], [data-ic-x]').forEach(function(g){
  if (!g.isConnected || g.closest('figure.v3-diagram') || g.closest('.v4-mermaid') || g.closest('[class*="logo"]')) return;
  if (g.tagName.toLowerCase() === 'svg' && ((g.parentElement && g.parentElement.closest('svg')) || g.querySelector('text'))) return;
  var r = g.getBoundingClientRect(); if (r.width < 12 || r.height < 12 || r.width * r.height > 1280*720*0.5) return;
  if (parseFloat(getComputedStyle(g).opacity) < 0.35) return;
  var host = g, p = g.parentElement;
  while (p && p !== S && !(p.innerText || '').trim()) { var pr = p.getBoundingClientRect(); if (pr.width * pr.height > r.width * r.height * 9) break; host = p; p = p.parentElement; }
  var hr = host.getBoundingClientRect();
  var hit = tx.some(function(t){ if (host.contains(t.el) || t.el.contains(host)) return false; var ox = Math.min(hr.right, t.r.right) - Math.max(hr.left, t.r.left), oy = Math.min(hr.bottom, t.r.bottom) - Math.max(hr.top, t.r.top); return ox > 4 && oy > 4 && ox * oy >= 0.12 * Math.min(hr.width * hr.height, t.r.width * t.r.height); });
  if (hit){ out.push('removed a graphic lying on text (' + Math.round(hr.width) + '×' + Math.round(hr.height) + ')'); host.remove(); }
});
// painted shapes without text drawn ON TOP of text (bars, blocks), and big empty placeholder panels: removed
S.querySelectorAll('div,span,figure,section,aside').forEach(function(el){
  if (!el.isConnected || el.closest('svg') || el.closest('figure.v3-diagram') || el.closest('[class*="logo"]')) return;
  if ((el.innerText || '').trim() || el.querySelector('img,svg,[data-icon],[data-ic-x],canvas,video')) return;
  var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.2) return;
  var painted = (cs.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || cs.backgroundImage !== 'none';
  if (!painted) return;
  var r = el.getBoundingClientRect(); var a = r.width * r.height; if (a < 400 || a > 1280 * 720 * 0.6) return;
  var under = tx.filter(function(t){ var tt = (t.el.innerText || '').trim(); if (parseFloat(getComputedStyle(t.el).fontSize) <= 18 || /^[\d\s\/.#]+$/.test(tt)) return false; var ox = Math.min(r.right, t.r.right) - Math.max(r.left, t.r.left), oy = Math.min(r.bottom, t.r.bottom) - Math.max(r.top, t.r.top); return ox > 3 && oy > 3 && ox * oy >= 0.5 * t.r.width * t.r.height; });
  if (!under.length){
    // nothing sits on it: a big empty box (an image slot that never got its image) is removed; small accents stay
    var overGfx = Array.prototype.some.call(S.querySelectorAll('img,svg,[data-icon],[data-ic-x]'), function(g){ if (g.closest('svg') && g.tagName.toLowerCase() !== 'svg') return false; var q = g.getBoundingClientRect(); return Math.min(r.right, q.right) - Math.max(r.left, q.left) > 8 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 8; });
    var band = r.height >= 690 || r.width >= 1200;
    if (a > 1280 * 720 * 0.08 && !overGfx && !band && role !== 'title' && role !== 'closing') { out.push('removed an empty placeholder panel (' + Math.round(r.width) + '×' + Math.round(r.height) + ')'); el.remove(); }
    return;
  }
  // drawn above the text? (elementFromPoint at the overlap)
  var covering = under.some(function(t){ var x0 = Math.max(r.left, t.r.left), x1 = Math.min(r.right, t.r.right), y0 = Math.max(r.top, t.r.top), y1 = Math.min(r.bottom, t.r.bottom); var hits = 0;
    for (var k = 1; k <= 3; k++){ var e = document.elementFromPoint(x0 + (x1 - x0) * k / 4, (y0 + y1) / 2); if (e && (e === el || el.contains(e))) hits++; } return hits >= 2; });
  if (covering && (r.width < 40 || r.height < 40 || a < 1280 * 720 * 0.05)) { out.push('removed a shape drawn over text (' + Math.round(r.width) + '×' + Math.round(r.height) + ')'); el.remove(); }
});
var killed = 0;
[S].concat(Array.prototype.slice.call(S.querySelectorAll('*'))).forEach(function(el){ ['::before','::after'].forEach(function(p){ var s = getComputedStyle(el, p); var c = s.content || '';
  if (c === 'none' || c === 'normal') return; if (parseFloat(s.fontSize) < 56) return;
  if (/^"(no\.?\s*|#)?0?\d{1,2}[.)\/]?"$/i.test(c) || /attr\(data-n\)|counter\(/.test(c)){ el.classList.add(p === '::before' ? 'v4-nodeco-b' : 'v4-nodeco-a'); killed++; } }); });
if (killed){ var st = document.createElement('style'); st.setAttribute('data-v4','nodeco'); st.textContent = '.v4-nodeco-b::before{content:none !important}.v4-nodeco-a::after{content:none !important}'; S.appendChild(st); out.push('removed ' + killed + ' decorative numeral(s) drawn by CSS'); }
return out;
})`;

/** type floor: body (≥ 6 words) 20px, everything readable 18px */
export const FONT_FLOOR_JS = String.raw`(function(role){
var S = document.querySelector('section.slide'); var out = []; if (role === 'references') return out;
var SKIP = ${SKIP_TEXT};
function own(el){ var s = ''; el.childNodes.forEach(function(n){ if (n.nodeType === 3) s += n.textContent; }); return s.trim(); }
S.querySelectorAll('*').forEach(function(el){
  if (el.closest('svg') || el.closest('figure.v3-diagram') || /^(STYLE|SCRIPT|SUP|SUB)$/.test(el.tagName) || el.closest('sup')) return;
  if (el.closest('[class*="logo"]') || el.closest('[class*="credit"]') || el.closest('[class*="source"]') || el.closest('footer') || el.closest('[class*="cite"]')) return;
  var t = own(el); if (!t || t.replace(/[^\p{L}\p{N}]/gu, '').length < 2) return;
  var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.4) return;
  var whole = (el.innerText || '').trim(); if (SKIP.test(whole) || SKIP.test(t)) return;
  var fs = parseFloat(cs.fontSize); var words = whole.split(/\s+/).filter(Boolean).length; var min = words >= 3 ? 20 : 18;
  if (fs < min - 0.4){ el.style.setProperty('font-size', min + 'px', 'important'); out.push('type ' + Math.round(fs) + '→' + min + 'px "' + whole.slice(0, 24) + '"'); }
});
return out;
})`;

/** where the content ends (px from the top), ignoring the engine corner logo and source/credit lines */
export const CONTENT_BOTTOM_JS = String.raw`(function(){
var S = document.querySelector('section.slide'); var SR = S.getBoundingClientRect(); var SKIP = ${SKIP_TEXT};
var bottom = 0;
S.querySelectorAll('*').forEach(function(el){
  if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
  if (/^(STYLE|SCRIPT)$/.test(el.tagName) || el.closest('[class*="logo"]') || el.closest('[data-engine-logo]')) return;
  var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) return;
  var r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
  if (r.width * r.height > 1280 * 720 * 0.6) return; // full-bleed backgrounds / scrims
  if (r.width >= 1200 && r.height <= 12) return; // rules/bars across the slide
  var txt = (el.innerText || '').trim(); if (txt && SKIP.test(txt) && parseFloat(cs.fontSize) <= 20) return;
  var paints = el.tagName === 'IMG' || el.tagName.toLowerCase() === 'svg' || (cs.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || cs.backgroundImage !== 'none';
  var hasText = false; el.childNodes.forEach(function(n){ if (n.nodeType === 3 && n.textContent.trim()) hasText = true; });
  if (!paints && !hasText) return;
  bottom = Math.max(bottom, r.bottom - SR.top);
});
return Math.round(bottom);
})()`;

/** grows the main content block: taller (cards stretch), bigger type (factor), content centred inside cards */
export const GROW_JS = String.raw`(function(f){
var S = document.querySelector('section.slide'); var SR = S.getBoundingClientRect(); var out = [];
var title = S.querySelector('h1,h2'); var tb = title ? title.getBoundingClientRect().bottom - SR.top : 150;
function paints(el){ var cs = getComputedStyle(el); return (cs.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || cs.backgroundImage !== 'none' || (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') || (parseFloat(cs.borderLeftWidth) >= 2 && cs.borderLeftStyle !== 'none'); }
// the content root: the largest block below the title band that holds ≥ 2 element children and no h1/h2
var best = null, bestA = 0;
S.querySelectorAll('div,ul,ol,section,article,main').forEach(function(el){
  if (el === S || el.closest('svg') || el.querySelector('h1,h2') || el.closest('[class*="logo"]')) return;
  var r = el.getBoundingClientRect(); var top = r.top - SR.top;
  if (top < tb - 10 || r.width < 420 || el.children.length < 2) return;
  var a = r.width * r.height; if (a > bestA){ best = el; bestA = a; }
});
if (!best) return out;
var r = best.getBoundingClientRect(); var top = r.top - SR.top; var cs = getComputedStyle(best);
var target = Math.max(r.height, 652 - top);
// a narrow block floating in the middle of the slide gets the full content width
if (r.width < 980 && cs.position === 'absolute' && (cs.display.indexOf('grid') >= 0 || (cs.display.indexOf('flex') >= 0 && cs.flexDirection.indexOf('row') === 0))){
  best.style.setProperty('width', '1120px', 'important'); best.style.setProperty('max-width', '1120px', 'important');
  best.style.setProperty('left', '80px', 'important'); best.style.setProperty('right', 'auto', 'important'); best.style.setProperty('transform', 'none', 'important');
  out.push('content block widened ' + Math.round(r.width) + '→1120px');
}
if (cs.position === 'absolute' && cs.bottom !== 'auto' && cs.top !== 'auto') { best.style.setProperty('bottom', 'auto', 'important'); }
best.style.setProperty('height', 'auto', 'important');
best.style.setProperty('max-height', 'none', 'important');
best.style.setProperty('min-height', target + 'px', 'important');
if (cs.display.indexOf('grid') >= 0){ best.style.setProperty('grid-auto-rows', '1fr', 'important'); best.style.setProperty('align-content', 'stretch', 'important'); best.style.setProperty('align-items', 'stretch', 'important'); }
else if (cs.display.indexOf('flex') >= 0){ if (cs.flexDirection.indexOf('column') === 0) best.style.setProperty('justify-content', 'space-evenly', 'important'); else best.style.setProperty('align-items', 'stretch', 'important'); }
// connectors / arrows / dots between the cards keep their size and sit centred (never stretched into bars)
Array.prototype.forEach.call(best.children, function(k){ if ((k.innerText || '').trim()) return; var kr = k.getBoundingClientRect(); k.style.setProperty('align-self', 'center', 'important'); k.style.setProperty('justify-self', 'center', 'important'); if (kr.height > 0) k.style.setProperty('height', kr.height + 'px', 'important'); if (kr.width > 0) k.style.setProperty('width', kr.width + 'px', 'important'); });
out.push('content block ' + Math.round(r.height) + '→' + Math.round(target) + 'px tall');
// cards: content centred vertically so the extra height reads as design, not as a gap
Array.prototype.forEach.call(best.children, function(k){ if (!paints(k) || !(k.innerText || '').trim()) return; var kc = getComputedStyle(k);
  k.style.setProperty('height', 'auto', 'important'); k.style.setProperty('max-height', 'none', 'important');
  if (kc.display === 'flex' && kc.flexDirection.indexOf('column') === 0) k.style.setProperty('justify-content', 'center', 'important');
  else if (kc.display === 'block'){ k.style.setProperty('display', 'flex', 'important'); k.style.setProperty('flex-direction', 'column', 'important'); k.style.setProperty('justify-content', 'center', 'important'); k.style.setProperty('align-items', kc.textAlign === 'center' ? 'center' : 'flex-start', 'important'); }
});
if (f > 1.001){
  var n = 0;
  best.querySelectorAll('*').forEach(function(el){ if (el.closest('svg') || /^(STYLE|SCRIPT|SUP)$/.test(el.tagName)) return;
    var own = ''; el.childNodes.forEach(function(c){ if (c.nodeType === 3) own += c.textContent; }); if (!own.trim()) return;
    var fs = parseFloat(getComputedStyle(el).fontSize); var cap = /^H[3-6]$/.test(el.tagName) || fs >= 28 ? 44 : 30;
    var nf = Math.min(cap, Math.round(fs * f)); if (nf > fs){ el.style.setProperty('font-size', nf + 'px', 'important'); n++; } });
  // icons inside the block grow a little too
  best.querySelectorAll('[data-icon],[data-ic-x]').forEach(function(ic){ var w = ic.getBoundingClientRect().width; if (w > 8 && w < 90) ic.style.setProperty('--ic-size', Math.round(Math.min(96, w * Math.min(f, 1.3))) + 'px'); });
  if (n) out.push('type ×' + f.toFixed(2) + ' on ' + n + ' text(s)');
}
return out;
})`;

/** how empty the cards of the main content block are (0 = text fills them, 1 = empty) */
export const CARD_SLACK_JS = String.raw`(function(){
var S = document.querySelector('section.slide'); var vals = [];
S.querySelectorAll('*').forEach(function(el){ if (el.closest('svg') || el === S) return; var cs = getComputedStyle(el);
  var painted = (cs.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none');
  if (!painted) return; var r = el.getBoundingClientRect(); if (r.width < 160 || r.height < 140 || r.width * r.height > 1280 * 720 * 0.35) return;
  var top = 1e9, bot = -1e9; el.querySelectorAll('*').forEach(function(k){ if (k.closest('svg') && k.tagName.toLowerCase() !== 'svg') return; var kr = k.getBoundingClientRect(); if (kr.height < 4) return; top = Math.min(top, kr.top); bot = Math.max(bot, kr.bottom); });
  if (bot < top) return; vals.push(1 - (bot - top) / r.height); });
if (vals.length < 2) return 0;
return vals.reduce(function(a, b){ return a + b; }, 0) / vals.length;
})()`;

const BAD = new Set(["text-clipped", "out-of-canvas", "text-past-panel", "text-overlap", "text-covered", "label-overlap", "label-clipped"]);

async function run(deck: Pick<Deck, "assets" | "design"> & { engine?: string }, n: number, html: string, renderDir: string, step: (page: any) => Promise<string[]>) {
  const doc = slideDocument(deck.design, html, { assetBase: "../assets/", deck, n });
  const page = await openSlide(doc, renderDir, `fin-${String(n).padStart(2, "0")}`);
  try {
    const fixes = await step(page);
    const m: any = await page.evaluate(MEASURE_JS);
    const bad = (m.issues as any[]).filter((i) => (BAD.has(i.type) && i.severity === "high") || (i.type === "edge" && i.severity === "high")).length;
    const bottom: number = await page.evaluate(CONTENT_BOTTOM_JS);
    const slack = Number(await page.evaluate(CARD_SLACK_JS).catch(() => 0)) || 0;
    const out = fixes.length ? unresolve(await page.evaluate(SERIALIZE_JS), "../assets/", deck) : html;
    return { html: out, fixes, bad, bottom, slack };
  } finally {
    await closePage(page).catch(() => {});
  }
}

export async function finishSlideV4(deck: Pick<Deck, "assets" | "design"> & { engine?: string }, n: number, html: string, renderDir: string, role: string): Promise<{ html: string; fixes: string[]; bottom: number }> {
  const base = await run(deck, n, html, renderDir, async () => []);
  let cur = base;
  const fixes: string[] = [];
  // 1. decorative numerals: always removed (removing never creates an overflow)
  const d = await run(deck, n, cur.html, renderDir, (p) => p.evaluate(`(${DECOR_JS})(${JSON.stringify(role)})`));
  if (d.fixes.length) {
    cur = d;
    fixes.push(...d.fixes);
  }
  // 2. type floor (kept unless it breaks the layout)
  const f = await run(deck, n, cur.html, renderDir, (p) => p.evaluate(`(${FONT_FLOOR_JS})(${JSON.stringify(role)})`));
  if (f.fixes.length) {
    if (f.bad <= cur.bad) {
      cur = f;
      fixes.push(...f.fixes.slice(0, 6));
    } else fixes.push(`type floor skipped: it would overflow (${f.bad} vs ${cur.bad} layout problems)`);
  }
  // 3. fill the slide when the lower part is empty
  const fillRoles = !["title", "references", "closing", "quote", "section"].includes(role);
  if (fillRoles && cur.bottom > 0 && cur.bottom < 560) {
    for (const k of [1.35, 1.22, 1.1, 1]) {
      const g = await run(deck, n, cur.html, renderDir, (p) => p.evaluate(`(${GROW_JS})(${k})`));
      if (g.fixes.length && g.bad <= cur.bad && g.bottom > cur.bottom + 40 && g.bottom <= 700) {
        fixes.push(...g.fixes, `content now ends at ${g.bottom}px (was ${cur.bottom}px)`);
        cur = g;
        break;
      }
    }
  }
  // 4. cards that are mostly empty inside: bigger type and icons (the block keeps its size)
  if (fillRoles && cur.slack > 0.42) {
    for (const k of [1.3, 1.18, 1.1]) {
      const g = await run(deck, n, cur.html, renderDir, (p) => p.evaluate(`(${GROW_JS})(${k})`));
      if (g.fixes.length && g.bad <= cur.bad && g.slack < cur.slack - 0.05 && g.bottom <= 700) {
        fixes.push(...g.fixes, `cards ${Math.round(cur.slack * 100)}% → ${Math.round(g.slack * 100)}% empty`);
        cur = g;
        break;
      }
    }
  }
  return { html: cur.html, fixes, bottom: cur.bottom };
}
