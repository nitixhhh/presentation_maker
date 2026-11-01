/**
 * Engine v3 — deterministic layout geometry check + auto-fix (runs inside the rendered 1280×720 slide).
 *
 * MEASURE_JS (domScripts.ts) already checks HTML text blocks (clipped, out of canvas, text-text overlap, covered).
 * GEOMETRY_JS adds what the test decks showed slipping through:
 *   - SVG <text> labels (hand-drawn diagrams): label-label and label-text overlap, labels cut off by their <svg>
 *     box or the slide frame, labels smaller than 18px (rendered size);
 *   - lines/arrows (SVG strokes, thin HTML rules) crossing any text where the line is actually visible
 *     (nothing opaque between the line and the eye — a text backdrop or a label halo counts as opaque);
 *   - filled shapes painted on top of an SVG label.
 * Every issue carries the element and its coordinates (x, y, w×h in slide pixels) so the AI fix round gets
 * exact instructions, and the code re-measures after every fix: a slide passes only when this finds nothing.
 *
 * GEOMETRY_FIX_JS is the deterministic last resort (after the AI rounds): shrink labels to a floor, move
 * overlapping/clipped SVG labels, and give text crossed by a line a backdrop (HTML) or halo (SVG).
 * It never touches the engine's own diagram component layer (.v3d — redrawn on every load).
 */

const GEOM_COMMON = String.raw`
var SLIDE = document.querySelector('section.slide') || document.body;
var SR = SLIDE.getBoundingClientRect();
function cs(e){ return getComputedStyle(e); }
function alphaOf(c){ if (!c || c === 'transparent') return 0; var m = /rgba?\(([^)]*)\)/.exec(c); if (!m) return 1; var p = m[1].split(/[\s,\/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; }
function op(e){ var o = 1; for (var p = e; p && p.nodeType === 1; p = p.parentElement || p.parentNode){ var s = cs(p); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= parseFloat(s.opacity); if (p === SLIDE) break; } return o; }
function R(r){ return {x: Math.round(r.left - SR.left), y: Math.round(r.top - SR.top), w: Math.round(r.width), h: Math.round(r.height)}; }
function fmt(b){ return '(x=' + b.x + ', y=' + b.y + ', ' + b.w + '×' + b.h + 'px)'; }
function inter(a, b){ var x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h); return (x2 > x && y2 > y) ? {x: x, y: y, w: x2 - x, h: y2 - y} : null; }
function union(rs){ var x = 1e9, y = 1e9, x2 = -1e9, y2 = -1e9; rs.forEach(function(r){ x = Math.min(x, r.x); y = Math.min(y, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h); }); return {x: x, y: y, w: x2 - x, h: y2 - y}; }
function scaleOf(el){ var m = el.getScreenCTM && el.getScreenCTM(); return m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1 : 1; }
function inComponent(el){ return !!(el.closest && el.closest('.v3d')); }
function bgBehind(el){ for (var p = el.parentElement; p; p = p.parentElement){ var c = cs(p).backgroundColor; if (alphaOf(c) > 0.6) return c; if (p === SLIDE) break; } var b = cs(SLIDE).backgroundColor; return alphaOf(b) > 0.6 ? b : (cs(document.body).backgroundColor || '#ffffff'); }
/** text items: HTML blocks marked by MEASURE_JS + SVG <text> */
function collect(){
  var items = [];
  SLIDE.querySelectorAll('[data-v3-text]').forEach(function(el){
    if (el.closest('svg') || op(el) < 0.35) return;
    var txt = (el.innerText || '').trim(); if (!txt) return;
    var rg = document.createRange(); rg.selectNodeContents(el);
    var rects = [].slice.call(rg.getClientRects()).filter(function(r){ return r.width > 2 && r.height > 2; }).map(R);
    if (!rects.length) return;
    items.push({kind: 'html', el: el, id: 'h' + el.getAttribute('data-v3-text'), text: txt.replace(/\s+/g, ' ').slice(0, 40), rects: rects, box: union(rects), fs: parseFloat(cs(el).fontSize), words: txt.split(/\s+/).length});
  });
  var si = 0;
  SLIDE.querySelectorAll('svg text').forEach(function(t){
    if (t.closest('defs,marker,clipPath,mask,pattern,symbol') || op(t) < 0.35) return;
    var txt = (t.textContent || '').trim(); if (!txt) return;
    var r = t.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    var id = t.getAttribute('data-v3-svgt'); if (!id){ id = String(si); t.setAttribute('data-v3-svgt', id); } si++;
    items.push({kind: 'svg', el: t, id: 's' + id, text: txt.replace(/\s+/g, ' ').slice(0, 40), rects: [R(r)], box: R(r), fs: parseFloat(cs(t).fontSize) * scaleOf(t), words: txt.split(/\s+/).length});
  });
  return items;
}
function find(id){ return id.charAt(0) === 's' ? SLIDE.querySelector('[data-v3-svgt="' + id.slice(1) + '"]') : SLIDE.querySelector('[data-v3-text="' + id.slice(1) + '"]'); }
`;

export const GEOMETRY_JS = String.raw`(function(){
` + GEOM_COMMON + String.raw`
var items = collect(); var issues = [];
function haloed(e){ if (!e || e.namespaceURI !== 'http://www.w3.org/2000/svg' || e.tagName.toLowerCase() !== 'text') return false; var s = cs(e); return /^stroke/.test((s.paintOrder || '').trim()) && s.stroke !== 'none' && parseFloat(s.strokeWidth) * scaleOf(e) >= 2; }
function opaque(e){ if (e.namespaceURI === 'http://www.w3.org/2000/svg'){ var s = cs(e); if (/^(rect|circle|ellipse|polygon|path)$/i.test(e.tagName) && s.fill !== 'none' && alphaOf(s.fill) * parseFloat(s.fillOpacity || 1) * op(e) > 0.6) return true; return haloed(e); }
  var st = cs(e); return alphaOf(st.backgroundColor) * op(e) > 0.6 || (st.backgroundImage !== 'none' && op(e) > 0.6) || /^(IMG|VIDEO|CANVAS)$/.test(e.tagName); }
/** is the stroke of shape visible at slide point (x,y)? (nothing opaque painted between it and the viewer) */
function strokeVisibleAt(shape, x, y, textEl){
  var stack = document.elementsFromPoint(SR.left + x, SR.top + y);
  for (var i = 0; i < stack.length; i++){ var e = stack[i];
    if (e === shape || e.contains(shape)) return true;
    if (e === textEl && (haloed(e) || alphaOf(cs(e).backgroundColor) > 0.6)) return false;
    if (e === textEl || (textEl.contains && textEl.contains(e))) continue;
    if (opaque(e)) return false; }
  return false;
}

// 1. label overlaps (anything involving an SVG label; HTML–HTML pairs are MEASURE_JS's job)
for (var i = 0; i < items.length; i++) for (var j = i + 1; j < items.length; j++){
  var A = items[i], B = items[j]; if (A.kind === 'html' && B.kind === 'html') continue;
  if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
  var best = null, area = 0;
  A.rects.forEach(function(ra){ B.rects.forEach(function(rb){ var x = inter(ra, rb); if (x && x.w * x.h > area){ area = x.w * x.h; best = x; } }); });
  var minA = Math.min(A.box.w * A.box.h, B.box.w * B.box.h);
  if (best && area >= 24 && area >= 0.06 * minA)
    issues.push({type: 'label-overlap', severity: 'high', id: A.id + '|' + B.id, box: best, detail: 'Labels "' + A.text + '" ' + fmt(A.box) + ' and "' + B.text + '" ' + fmt(B.box) + ' overlap by ' + best.w + '×' + best.h + 'px — give each label its own space (move one, shorten it, or make the diagram bigger).'});
}

// 2. lines / arrows / outlines crossing text (SVG strokes + thin HTML rules)
var shapes = [].slice.call(SLIDE.querySelectorAll('svg line, svg polyline, svg polygon, svg path, svg rect, svg circle, svg ellipse')).filter(function(s){ return !s.closest('defs,marker,clipPath,mask,pattern,symbol,svg.dc-icon') && op(s) > 0.3; });
var hitsBy = {};
shapes.forEach(function(s, si){
  var st = cs(s); if (st.stroke === 'none' || alphaOf(st.stroke) * parseFloat(st.strokeOpacity || 1) < 0.3) return;
  var sw = parseFloat(st.strokeWidth) * scaleOf(s); if (!(sw > 0.4)) return;
  var L = 0; try { L = s.getTotalLength(); } catch (e) { return; } if (!(L > 0)) return;
  var m = s.getScreenCTM(); if (!m) return; var sc = scaleOf(s);
  var n = Math.min(800, Math.max(8, Math.ceil(L * sc / 4)));
  var pts = [];
  for (var k = 0; k <= n; k++){ var p = s.getPointAtLength(L * k / n); pts.push({x: m.a * p.x + m.c * p.y + m.e - SR.left, y: m.b * p.x + m.d * p.y + m.f - SR.top}); }
  items.forEach(function(t){
    if (t.el === s || (t.kind === 'svg' && t.el.parentNode && t.el.parentNode === s)) return;
    var c = 0, at = null;
    pts.forEach(function(p){ if (c > 6) return; t.rects.forEach(function(r){ if (p.x > r.x + 2 && p.x < r.x + r.w - 2 && p.y > r.y + 2 && p.y < r.y + r.h - 2 && strokeVisibleAt(s, p.x, p.y, t.el)){ c++; at = at || p; } }); });
    if (c >= 2){ var key = t.id; if (!hitsBy[key]) hitsBy[key] = {t: t, at: at, what: /line|polyline|path/.test(s.tagName) ? 'a line/arrow' : 'a shape outline'}; }
  });
});
// thin HTML rules / bars (≤ 6px thick) drawn across text
SLIDE.querySelectorAll('*').forEach(function(e){
  if (e.closest('svg') || e.hasAttribute('data-v3-text') || inComponent(e)) return;
  var r = e.getBoundingClientRect(); if (r.width < 12 && r.height < 12) return;
  var thick = Math.min(r.width, r.height); if (thick > 6 || thick < 0.5) return;
  var st = cs(e); if (!(alphaOf(st.backgroundColor) > 0.3 || st.backgroundImage !== 'none')) return;
  var b = R(r);
  items.forEach(function(t){ if (t.el.contains(e) || e.contains(t.el)) return;
    t.rects.forEach(function(rr){ var x = inter(rr, b); if (!x || hitsBy[t.id]) return; var cx = x.x + x.w / 2, cy = x.y + x.h / 2;
      if (x.w * x.h >= 6 && cx > rr.x + 2 && cx < rr.x + rr.w - 2 && cy > rr.y + 2 && cy < rr.y + rr.h - 2 && strokeVisibleAt(e, cx, cy, t.el)) hitsBy[t.id] = {t: t, at: {x: cx, y: cy}, what: 'a line/rule'}; }); });
});
Object.keys(hitsBy).forEach(function(k){ var h = hitsBy[k];
  issues.push({type: 'line-over-text', severity: 'high', id: h.t.id, box: h.t.box, detail: h.what.charAt(0).toUpperCase() + h.what.slice(1) + ' runs through the text "' + h.t.text + '" ' + fmt(h.t.box) + ' near (x=' + Math.round(h.at.x) + ', y=' + Math.round(h.at.y) + ') — route arrows/lines around text, end them at box edges, or move the text.'}); });

// 3. SVG labels covered by a filled shape / box painted on top of them
items.forEach(function(t){ if (t.kind !== 'svg' || hitsBy[t.id]) return;
  var b = t.box, hits = 0, by = '';
  for (var gx = 1; gx <= 5; gx++) for (var gy = 1; gy <= 3; gy++){
    var x = b.x + b.w * gx / 6, y = b.y + b.h * gy / 4; var stack = document.elementsFromPoint(SR.left + x, SR.top + y);
    for (var q = 0; q < stack.length; q++){ var e = stack[q]; if (e === t.el || t.el.contains(e) || e.contains(t.el)) break; if (e.tagName && /^(svg|g)$/i.test(e.tagName)) continue; if (opaque(e)){ hits++; by = e.tagName.toLowerCase(); break; } }
  }
  if (hits >= 2) issues.push({type: 'text-covered', severity: 'high', id: t.id, box: b, detail: 'Label "' + t.text + '" ' + fmt(b) + ' is partly hidden under a ' + by + ' drawn on top of it — move it or draw the label last.'});
});

// 4. SVG labels cut off by their own <svg> box or the slide frame
items.forEach(function(t){ if (t.kind !== 'svg') return; var b = t.box;
  var out = b.x < -2 || b.y < -2 || b.x + b.w > 1282 || b.y + b.h > 722;
  var sv = t.el.ownerSVGElement; var clipped = false;
  if (sv && !/visible/.test(cs(sv).overflow)){ var vb = R(sv.getBoundingClientRect()); clipped = b.x < vb.x - 2 || b.y < vb.y - 2 || b.x + b.w > vb.x + vb.w + 2 || b.y + b.h > vb.y + vb.h + 2; }
  if (out || clipped) issues.push({type: 'label-clipped', severity: 'high', id: t.id, box: b, detail: 'Label "' + t.text + '" ' + fmt(b) + ' is cut off by ' + (out ? 'the slide edge' : 'its diagram box') + ' — keep every label inside the drawing area.'});
});

// 5. labels below 18px (rendered); citations, superscripts, 1–2 character badges and faded decoration excluded
items.forEach(function(t){
  if (!(t.fs > 0) || t.fs >= 18 || t.text.length <= 2 || /^\s*\[?\d+([,–-]\d+)*\]?\s*$/.test(t.text) || /https?:|doi|wikimedia|cc by|credit/i.test(t.text)) return;
  if (t.kind === 'html' && (t.words >= 7 || t.el.closest('sup,sub,figcaption,footer,cite'))) return; // body text: MEASURE_JS small-body
  issues.push({type: 'small-label', severity: t.fs < 13 ? 'high' : 'medium', id: t.id, box: t.box, detail: 'Label "' + t.text + '" ' + fmt(t.box) + ' renders at ' + Math.round(t.fs) + 'px — labels need at least 18px to read from the back of a classroom.'});
});
return {issues: issues, labels: items.filter(function(t){ return t.kind === 'svg'; }).length};
})()`;

/** Deterministic last-resort fixes for GEOMETRY_JS issues. Input: [{type, id}]. Returns what it changed. */
export const GEOMETRY_FIX_JS = String.raw`(function(list){
` + GEOM_COMMON + String.raw`
collect();
var done = [];
function setFont(t, px){ t.style.fontSize = px + 'px'; }
function translate(t, dx, dy){ var sc = scaleOf(t) || 1; var prev = t.getAttribute('transform') || ''; t.setAttribute('transform', (prev + ' translate(' + (dx / sc).toFixed(1) + ' ' + (dy / sc).toFixed(1) + ')').trim()); }
function haloSvg(t){ var bg = bgBehind(t.ownerSVGElement || t); t.style.paintOrder = 'stroke'; t.style.stroke = bg; t.style.strokeWidth = (5 / (scaleOf(t) || 1)).toFixed(2) + 'px'; t.style.strokeLinejoin = 'round'; if (t.parentNode) t.parentNode.appendChild(t); }
function backdropHtml(el){ var s = cs(el); if (alphaOf(s.backgroundColor) < 0.6) { el.style.backgroundColor = bgBehind(el); el.style.boxDecorationBreak = 'clone'; el.style.webkitBoxDecorationBreak = 'clone'; if (parseFloat(s.paddingLeft) < 3) { el.style.paddingLeft = '4px'; el.style.paddingRight = '4px'; } el.style.borderRadius = el.style.borderRadius || '4px'; }
  if (s.position === 'static') el.style.position = 'relative'; el.style.zIndex = '30'; }
list.forEach(function(it){
  var ids = String(it.id || '').split('|'); var el = find(ids[ids.length - 1]); if (!el || inComponent(el)) return;
  var isSvg = ids[ids.length - 1].charAt(0) === 's';
  if (it.type === 'label-clipped' && isSvg){
    var sv = el.ownerSVGElement; var b = R(el.getBoundingClientRect());
    if (sv && b.x >= 0 && b.y >= 0 && b.x + b.w <= 1280 && b.y + b.h <= 720){ sv.style.overflow = 'visible'; done.push('unclip ' + it.id); return; }
    var fs = parseFloat(cs(el).fontSize) * scaleOf(el); var floor = 14;
    while (fs > floor && (b.x < 0 || b.x + b.w > 1280)){ fs = Math.max(floor, fs * 0.9); setFont(el, fs / scaleOf(el)); b = R(el.getBoundingClientRect()); }
    var dx = b.x < 4 ? 4 - b.x : (b.x + b.w > 1276 ? 1276 - (b.x + b.w) : 0), dy = b.y < 4 ? 4 - b.y : (b.y + b.h > 716 ? 716 - (b.y + b.h) : 0);
    if (dx || dy) translate(el, dx, dy); if (sv) sv.style.overflow = 'visible'; done.push('fit ' + it.id); return;
  }
  if (it.type === 'label-overlap'){
    var other = find(ids[0]); if (!other) return;
    var mover = isSvg ? el : (ids[0].charAt(0) === 's' && !inComponent(other) ? other : null); var still = mover === el ? other : el; if (!mover) return;
    var a = R(still.getBoundingClientRect()), m = R(mover.getBoundingClientRect());
    var down = (m.y + m.h / 2) >= (a.y + a.h / 2); var dy2 = down ? (a.y + a.h + 4) - m.y : (a.y - 4) - (m.y + m.h);
    if (Math.abs(dy2) <= 70 && m.y + dy2 >= 2 && m.y + m.h + dy2 <= 718){ translate(mover, 0, dy2); done.push('move ' + (mover === el ? ids[1] : ids[0]) + ' ' + Math.round(dy2) + 'px'); return; }
    var f = parseFloat(cs(mover).fontSize) * scaleOf(mover); if (f > 14){ setFont(mover, Math.max(14, f * 0.85) / scaleOf(mover)); done.push('shrink ' + it.id); }
    return;
  }
  if (it.type === 'line-over-text' || it.type === 'text-covered'){
    if (isSvg) { haloSvg(el); done.push('halo ' + it.id); } else { backdropHtml(el); done.push('backdrop ' + it.id); }
  }
});
return done;
})`;
