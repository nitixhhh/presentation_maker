/**
 * Engine v3 — scripts evaluated inside the rendered slide (plain JS strings, so no bundler helpers leak in).
 *
 *  MEASURE_JS  → text blocks (with per-line runs), images, QA issues
 *  HIDE_JS     → hides natively-exported text/images so the remaining pixels become the PPTX background plate
 *  SHRINK_JS   → deterministic auto-fit for text that overflows its box / the canvas
 */

const COMMON = String.raw`
var SLIDE = document.querySelector('section.slide');
var SR = SLIDE.getBoundingClientRect();
function cs(el, p){ return getComputedStyle(el, p || null); }
function isAtomic(d){ return /^(inline-block|inline-flex|inline-grid|inline-table)$/.test(d); }
function isInlineEl(el){ var d = cs(el).display; return d.indexOf('inline') === 0 && !isAtomic(d) || d === 'contents'; }
function visible(el){ var s = cs(el); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.02; }
function inSvg(el){ return !!(el.closest && el.closest('svg')); }
function hasOwnText(el){
  for (var i=0;i<el.childNodes.length;i++){ var n = el.childNodes[i];
    if (n.nodeType === 3 && n.textContent.trim()) return true;
    if (n.nodeType === 1 && !inSvg(n) && n.tagName !== 'BR' && isInlineEl(n) && hasInlineText(n)) return true; }
  return false;
}
function hasInlineText(el){
  for (var i=0;i<el.childNodes.length;i++){ var n = el.childNodes[i];
    if (n.nodeType === 3 && n.textContent.trim()) return true;
    if (n.nodeType === 1 && isInlineEl(n) && hasInlineText(n)) return true; }
  return false;
}
function textBlocks(){
  var all = SLIDE.querySelectorAll('*'); var out = [];
  for (var i=0;i<all.length;i++){ var el = all[i];
    if (inSvg(el) || el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
    if (isInlineEl(el)) continue;
    if (!visible(el)) continue;
    if (hasOwnText(el)) out.push(el);
  }
  return out;
}
function rgbaParse(c){ var m = String(c).match(/rgba?\(([^)]+)\)/); if(!m) return null; var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
function hex2(n){ n = Math.max(0, Math.min(255, Math.round(n))); return (n<16?'0':'') + n.toString(16); }
function toHex(c){ var p = rgbaParse(c); return p ? (hex2(p.r)+hex2(p.g)+hex2(p.b)).toUpperCase() : '000000'; }
function alphaOf(c){ var p = rgbaParse(c); return p ? p.a : 1; }
function cumulativeOpacity(el){ var o = 1; while (el && el !== document.body){ o *= parseFloat(cs(el).opacity); el = el.parentElement; } return o; }
function hasTransform(el){ while (el && el !== SLIDE){ var t = cs(el).transform; if (t && t !== 'none'){ var m = t.match(/matrix\(([^)]+)\)/); if(!m) return true; var v = m[1].split(',').map(parseFloat); if (Math.abs(v[1])>0.001 || Math.abs(v[2])>0.001 || Math.abs(v[0]-1)>0.001 || Math.abs(v[3]-1)>0.001) return true; } el = el.parentElement; } return false; }
function effectAncestor(el){ while (el && el !== SLIDE){ var s = cs(el); if ((s.filter && s.filter !== 'none') || (s.mixBlendMode && s.mixBlendMode !== 'normal') || (s.clipPath && s.clipPath !== 'none') || (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none')) return true; el = el.parentElement; } return false; }
function ownerBlock(textNode, block){
  var p = textNode.parentElement;
  while (p && p !== block){ if (!isInlineEl(p)) return false; p = p.parentElement; }
  return p === block;
}
function blockRect(block){
  var r = document.createRange(); var L=1e9,T=1e9,R=-1e9,B=-1e9; var found=false;
  var tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
  var n; while ((n = tw.nextNode())){ if (!n.textContent.trim() || !ownerBlock(n, block)) continue;
    r.selectNodeContents(n); var rs = r.getClientRects();
    for (var i=0;i<rs.length;i++){ var q = rs[i]; if (q.width < 0.5) continue; found=true; L=Math.min(L,q.left); T=Math.min(T,q.top); R=Math.max(R,q.right); B=Math.max(B,q.bottom); } }
  return found ? {left:L-SR.left, top:T-SR.top, right:R-SR.left, bottom:B-SR.top, width:R-L, height:B-T} : null;
}
function clipAncestorRect(el){
  var p = el.parentElement; var rect = null;
  while (p && p !== document.body){ var s = cs(p);
    if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible'){ var q = p.getBoundingClientRect();
      var c = {left:q.left-SR.left, top:q.top-SR.top, right:q.right-SR.left, bottom:q.bottom-SR.top};
      rect = rect ? {left:Math.max(rect.left,c.left), top:Math.max(rect.top,c.top), right:Math.min(rect.right,c.right), bottom:Math.min(rect.bottom,c.bottom)} : c; }
    p = p.parentElement; }
  return rect;
}
`;

export const MEASURE_JS = String.raw`(function(){
${COMMON}
var issues = [];
var blocks = textBlocks();
var texts = [];
document.querySelectorAll('[data-v3-text],[data-v3-img],[data-v3-inl]').forEach(function(e){ e.removeAttribute('data-v3-text'); e.removeAttribute('data-v3-img'); e.removeAttribute('data-v3-inl'); });
var ptr = document.createElement('style'); ptr.textContent = '*{pointer-events:auto !important}'; document.head.appendChild(ptr);

blocks.forEach(function(block, bi){
  var bs = cs(block);
  var rect = blockRect(block); if (!rect) return;
  var fs = parseFloat(bs.fontSize);
  var lh = bs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(bs.lineHeight);
  var native = true; var why = '';
  var clip = (bs.backgroundClip === 'text' || bs.webkitBackgroundClip === 'text');
  if (clip || alphaOf(bs.webkitTextFillColor || bs.color) < 0.05) { native = false; why = 'gradient/transparent text'; }
  if (parseFloat(bs.webkitTextStrokeWidth || '0') > 0) { native = false; why = 'stroked text'; }
  if (hasTransform(block)) { native = false; why = 'transformed text'; }
  if (effectAncestor(block)) { native = false; why = 'text under filter/blend/mask'; }
  if (bs.writingMode && bs.writingMode.indexOf('vertical') === 0) { native = false; why = 'vertical text'; }

  // runs, line by line
  var lines = []; var cur = null; var lastTop = null; var lineTops = [];
  var range = document.createRange();
  var tw = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
  var n; var pendingSpace = false;
  var collapse = !/pre/.test(bs.whiteSpace);
  while ((n = tw.nextNode())){
    if (n.nodeType === 1){ if (n.tagName === 'BR' && ownerBlock(n, block)) { lastTop = -1e9; } continue; }
    if (!ownerBlock(n, block)) continue;
    var pe = n.parentElement; var ps = cs(pe);
    if (ps.display === 'none' || ps.visibility === 'hidden') continue;
    var style = {
      font: ps.fontFamily, size: parseFloat(ps.fontSize), weight: parseInt(ps.fontWeight,10) || 400,
      italic: ps.fontStyle === 'italic', color: toHex(ps.webkitTextFillColor && alphaOf(ps.webkitTextFillColor) > 0 ? ps.webkitTextFillColor : ps.color),
      alpha: alphaOf(ps.color), underline: ps.textDecorationLine.indexOf('underline') >= 0, strike: ps.textDecorationLine.indexOf('line-through') >= 0,
      spacing: ps.letterSpacing === 'normal' ? 0 : parseFloat(ps.letterSpacing), sup: (ps.verticalAlign === 'super' || pe.closest('sup') !== null), sub: (ps.verticalAlign === 'sub' || pe.closest('sub') !== null)
    };
    if (pe !== block && pe.closest) { pe.setAttribute('data-v3-inl', '1'); }
    var tt = ps.textTransform;
    var text = n.textContent;
    var tokens = text.split(/(\s+)/);
    var offset = 0;
    for (var ti=0; ti<tokens.length; ti++){
      var tok = tokens[ti]; var forced = false;
      if (tok.charAt(0) === '\u0000') { tok = tok.slice(1); forced = true; }
      var start = offset; offset += tok.length;
      if (!tok) continue;
      if (/^\s+$/.test(tok) && collapse) { pendingSpace = true; continue; }
      range.setStart(n, start); range.setEnd(n, start + tok.length);
      var rs = range.getClientRects(); if (!rs.length) continue;
      var q = rs[0];
      if (q.width < 0.1 && q.height < 0.1) continue;
      // a token broken across lines (e.g. at a hyphen): split it where the line changes
      if (rs.length > 1 && Math.abs(rs[rs.length-1].top - q.top) > Math.max(4, lh * 0.55)) {
        var cut = -1;
        for (var ci = 1; ci < tok.length; ci++) { range.setStart(n, start + ci); range.setEnd(n, start + ci + 1); var cr = range.getClientRects(); if (cr.length && cr[0].top > q.top + Math.max(4, lh * 0.55)) { cut = ci; break; } }
        if (cut > 0) { tokens.splice(ti + 1, 0, '\u0000' + tok.slice(cut)); tok = tok.slice(0, cut); offset = start + cut; range.setStart(n, start); range.setEnd(n, start + cut); }
      }
      var newLine = forced || (lastTop === null) || (q.top > lastTop + Math.max(4, lh * 0.55)) || lastTop === -1e9;
      if (rs.length > 1) newLine = newLine; // hyphenation is ignored
      var word = tok;
      if (tt === 'uppercase') word = word.toUpperCase(); else if (tt === 'lowercase') word = word.toLowerCase(); else if (tt === 'capitalize') word = word.replace(/(^|\s)(\S)/g, function(a,b,c){ return b + c.toUpperCase(); });
      if (newLine){ cur = []; lines.push(cur); lineTops.push(q.top - SR.top); lastTop = q.top; pendingSpace = false; }
      else if (pendingSpace) { word = ' ' + word; }
      pendingSpace = false;
      var last = cur.length ? cur[cur.length-1] : null;
      if (last && JSON.stringify(last.s) === JSON.stringify(style)) last.t += word; else cur.push({t: word, s: style});
    }
  }
  if (!lines.length) return;
  var id = 't' + bi;
  block.setAttribute('data-v3-text', id);
  texts.push({ id: id, tag: block.tagName.toLowerCase(), x: rect.left, y: rect.top, w: rect.width, h: rect.height, align: bs.textAlign, fontSize: fs, lineHeight: lh,
    lines: lines, lineTops: lineTops, native: native, why: why, opacity: cumulativeOpacity(block), marker: block.tagName === 'LI' && bs.listStyleType !== 'none',
    color: toHex(bs.color), words: block.innerText.trim().split(/\s+/).length });

  // ── QA on text ──
  var label = '"' + block.innerText.trim().slice(0, 50) + '"';
  if (rect.left < -2 || rect.top < -2 || rect.right > 1282 || rect.bottom > 722) issues.push({type:'out-of-canvas', severity:'high', detail: 'Text ' + label + ' goes outside the 1280x720 canvas (box ' + Math.round(rect.left) + ',' + Math.round(rect.top) + ' to ' + Math.round(rect.right) + ',' + Math.round(rect.bottom) + ').', id: id});
  var clipR = clipAncestorRect(block);
  if (clipR && (rect.bottom > clipR.bottom + 3 || rect.right > clipR.right + 3 || rect.top < clipR.top - 3 || rect.left < clipR.left - 3)) issues.push({type:'text-clipped', severity:'high', detail:'Text ' + label + ' is cut off by its container (overflow).', id:id});
  // a word wider than its own box spills sideways out of it (e.g. a 72px title in a 440px column): on a coloured
  // panel the spilled letters land on the background and look cut off. Reported as clipped so it is fixed.
  else { var ob = block.getBoundingClientRect(); var obL = ob.left - SR.left, obR = ob.right - SR.left;
    if (ob.width > 20 && (rect.right > obR + 4 || rect.left < obL - 4)) issues.push({type:'text-clipped', severity:'high', detail:'Text ' + label + ' is wider than its box (' + Math.round(ob.width) + 'px wide, text spills ' + Math.round(Math.max(rect.right - obR, obL - rect.left)) + 'px out) — a word is too long for this font size or column; make the column wider or the text smaller.', id:id}); }
  var minFs = 99; lines.forEach(function(l){ l.forEach(function(r){ if (!r.s.sup && r.t.trim().length > 2) minFs = Math.min(minFs, r.s.size); }); });
  var isRefLike = /^\s*\[\d+\]|https?:|doi|retrieved|wikipedia|credit|cc by|via wikimedia/i.test(block.innerText);
  if (minFs < 13 && !isRefLike) issues.push({type:'tiny-text', severity:'medium', detail:'Text ' + label + ' is only ' + minFs.toFixed(0) + 'px — too small for a classroom (min 16px for labels).', id:id});
  if (/\[(image|img|photo|diagram|chart|figure|placeholder)[^\]]*\]|lorem ipsum|placeholder|TODO/i.test(block.innerText)) issues.push({type:'placeholder', severity:'high', detail:'Placeholder text ' + label + '.', id:id});
  // text that runs past the card/panel it sits in (the panel's overflow is visible, so nothing is "clipped", but the
  // words spill onto the slide background — e.g. a long URL pushing a grid column out of a white panel)
  (function(){
    var p = block.parentElement, depth = 0;
    while (p && p !== SLIDE && depth < 8){
      var ps2 = cs(p);
      var paints = alphaOf(ps2.backgroundColor) > 0.15 || ps2.backgroundImage !== 'none' || (parseFloat(ps2.borderLeftWidth) > 0 && parseFloat(ps2.borderRightWidth) > 0 && parseFloat(ps2.borderTopWidth) > 0);
      if (paints){
        var pr = p.getBoundingClientRect();
        var P = {left: pr.left - SR.left, top: pr.top - SR.top, right: pr.right - SR.left, bottom: pr.bottom - SR.top};
        if ((P.right - P.left) * (P.bottom - P.top) > 1280 * 720 * 0.9) return; // a full-slide background, not a panel
        var out = Math.max(rect.right - P.right, P.left - rect.left, rect.bottom - P.bottom, P.top - rect.top);
        if (out > 4) issues.push({type:'text-past-panel', severity:'high', id:id, detail:'Text ' + label + ' runs ' + Math.round(out) + 'px outside the panel/card it sits in (panel x' + Math.round(P.left) + ' y' + Math.round(P.top) + ' w' + Math.round(P.right - P.left) + ' h' + Math.round(P.bottom - P.top) + ') — make the panel bigger, the text shorter/smaller, or let long words/URLs wrap.'});
        return;
      }
      p = p.parentElement; depth++;
    }
  })();
});

// overlaps between text blocks (ignore ancestor/descendant pairs)
for (var a=0;a<texts.length;a++) for (var b=a+1;b<texts.length;b++){
  var A = texts[a], Bt = texts[b];
  var ea = document.querySelector('[data-v3-text="'+A.id+'"]'), eb = document.querySelector('[data-v3-text="'+Bt.id+'"]');
  if (ea.contains(eb) || eb.contains(ea)) continue;
  if (A.opacity < 0.5 || Bt.opacity < 0.5 || ea.innerText.trim().length <= 3 || eb.innerText.trim().length <= 3) continue;
  var ix = Math.max(0, Math.min(A.x+A.w, Bt.x+Bt.w) - Math.max(A.x, Bt.x)); var iy = Math.max(0, Math.min(A.y+A.h, Bt.y+Bt.h) - Math.max(A.y, Bt.y));
  var inter = ix*iy; var small = Math.min(A.w*A.h, Bt.w*Bt.h);
  if (small > 0 && inter / small > 0.12) { var up = A.y <= Bt.y ? A : Bt, dn = A.y <= Bt.y ? Bt : A; var eu = up === A ? ea : eb, ed = up === A ? eb : ea;
    issues.push({type:'text-overlap', severity:'high', id: up.id + '|' + dn.id, detail:'Text "' + eu.innerText.trim().slice(0,40) + '" (box x' + Math.round(up.x) + ' y' + Math.round(up.y) + ' w' + Math.round(up.w) + ' h' + Math.round(up.h) + ') overlaps text "' + ed.innerText.trim().slice(0,40) + '" (box x' + Math.round(dn.x) + ' y' + Math.round(dn.y) + ' w' + Math.round(dn.w) + ' h' + Math.round(dn.h) + ') — they need separate space.'}); }
}

// images
var images = [];
var imgs = SLIDE.querySelectorAll('img');
imgs.forEach(function(img, ii){
  if (!visible(img)) return;
  var r = img.getBoundingClientRect(); var s = cs(img);
  var box = {left:r.left-SR.left, top:r.top-SR.top, width:r.width, height:r.height};
  if (!img.getAttribute('src') || img.naturalWidth === 0) { issues.push({type:'broken-image', severity:'high', detail:'An <img> did not load (src="' + (img.getAttribute('src')||'') + '"). Use only the listed asset ids.'}); return; }
  // visible rect after ancestor clipping + canvas
  var clipR = clipAncestorRect(img) || {left:0, top:0, right:1280, bottom:720};
  var vis = {left: Math.max(box.left, clipR.left, 0), top: Math.max(box.top, clipR.top, 0), right: Math.min(box.left+box.width, clipR.right, 1280), bottom: Math.min(box.top+box.height, clipR.bottom, 720)};
  if (vis.right - vis.left < 8 || vis.bottom - vis.top < 8) return;
  // source crop for object-fit / object-position
  var nw = img.naturalWidth, nh = img.naturalHeight, fit = s.objectFit;
  var dw = box.width, dh = box.height, scale, ox, oy;
  var pos = s.objectPosition.split(' ');
  function frac(v){ if (!v) return 0.5; if (v.indexOf('%')>0) return parseFloat(v)/100; if (v==='left'||v==='top') return 0; if (v==='right'||v==='bottom') return 1; if (v==='center') return 0.5; return null; }
  if (fit === 'cover' || fit === 'contain' || fit === 'none' || fit === 'scale-down'){
    if (fit === 'cover') scale = Math.max(dw/nw, dh/nh); else if (fit === 'contain') scale = Math.min(dw/nw, dh/nh); else if (fit === 'none') scale = 1; else scale = Math.min(1, Math.min(dw/nw, dh/nh));
    var rw = nw*scale, rh = nh*scale;
    var fx = frac(pos[0]), fy = frac(pos[1] || pos[0]);
    ox = fx === null ? parseFloat(pos[0]) : (dw - rw) * fx;
    oy = fy === null ? parseFloat(pos[1]) : (dh - rh) * fy;
  } else { scale = null; }
  var drawn; // where the bitmap is drawn, in slide px, and px->source mapping
  if (scale === null) drawn = {left: box.left, top: box.top, width: dw, height: dh, sx: nw/dw, sy: nh/dh};
  else drawn = {left: box.left + ox, top: box.top + oy, width: nw*scale, height: nh*scale, sx: 1/scale, sy: 1/scale};
  vis = {left: Math.max(vis.left, drawn.left), top: Math.max(vis.top, drawn.top), right: Math.min(vis.right, drawn.left+drawn.width), bottom: Math.min(vis.bottom, drawn.top+drawn.height)};
  var crop = {x: (vis.left - drawn.left) * drawn.sx, y: (vis.top - drawn.top) * drawn.sy, w: (vis.right - vis.left) * drawn.sx, h: (vis.bottom - vis.top) * drawn.sy};

  var native = true; var why = '';
  if (effectAncestor(img)) { native = false; why = 'filter/blend/mask/clip'; }
  if (hasTransform(img)) { native = false; why = 'transform'; }
  if (parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0 || (s.boxShadow && s.boxShadow !== 'none') || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0)) { native = false; why = 'border/shadow'; }
  var radius = parseFloat(s.borderTopLeftRadius) || 0;
  if (s.borderTopLeftRadius !== s.borderTopRightRadius || s.borderTopLeftRadius !== s.borderBottomLeftRadius || s.borderTopLeftRadius !== s.borderBottomRightRadius) { native = false; why = 'mixed corner radii'; }
  // rounded clipping container
  var p = img.parentElement; var depth = 0;
  while (p && p !== SLIDE && depth < 4){ var pst = cs(p); if (pst.overflow !== 'visible' && parseFloat(pst.borderTopLeftRadius) > 0){ if (pst.borderTopLeftRadius !== pst.borderBottomRightRadius || pst.borderTopLeftRadius !== pst.borderTopRightRadius) { native = false; why = 'mixed container radii'; } var pr = p.getBoundingClientRect(); radius = Math.max(radius, parseFloat(pst.borderTopLeftRadius)); if (pst.boxShadow !== 'none' || parseFloat(pst.borderTopWidth) > 0) { native = false; why = 'framed container'; } break; } p = p.parentElement; depth++; }
  if (/%/.test(s.borderTopLeftRadius)) radius = Math.min(box.width, box.height) * parseFloat(s.borderTopLeftRadius) / 100;
  // is anything painted on top of it (other than text we export natively)?
  if (native){
    var covered = false;
    for (var gx=1; gx<=4 && !covered; gx++) for (var gy=1; gy<=4 && !covered; gy++){
      var px = SR.left + vis.left + (vis.right-vis.left)*gx/5, py = SR.top + vis.top + (vis.bottom-vis.top)*gy/5;
      var stack = document.elementsFromPoint(px, py);
      for (var k=0;k<stack.length;k++){ var e = stack[k];
        if (e === img) break;
        if (e.hasAttribute('data-v3-inl')) continue;
        if (e.hasAttribute('data-v3-text')) { var es0 = cs(e); if (alphaOf(es0.backgroundColor) < 0.02 && es0.backgroundImage === 'none' && es0.boxShadow === 'none' && parseFloat(es0.borderTopWidth) === 0 && cs(e,'::before').content === 'none' && cs(e,'::after').content === 'none') continue; }
        var es = cs(e);
        var paints = alphaOf(es.backgroundColor) > 0.02 || es.backgroundImage !== 'none' || es.boxShadow !== 'none' || parseFloat(es.borderTopWidth) > 0 || /^(IMG|SVG|CANVAS|VIDEO|svg)$/.test(e.tagName) || e.closest('svg') || cs(e,'::before').content !== 'none' || cs(e,'::after').content !== 'none';
        if (e === SLIDE || e === document.body || e === document.documentElement) { if (cs(e,'::before').content !== 'none' || cs(e,'::after').content !== 'none') { covered = true; } break; }
        if (paints) { covered = true; why = 'covered by ' + e.tagName.toLowerCase(); break; }
      }
    }
    if (covered) native = false;
  }
  var id = 'i' + ii;
  img.setAttribute('data-v3-img', id);
  images.push({id: id, src: img.currentSrc || img.src, native: native, why: why, x: vis.left, y: vis.top, w: vis.right - vis.left, h: vis.bottom - vis.top,
    crop: crop, naturalW: nw, naturalH: nh, radius: radius, opacity: cumulativeOpacity(img)});
});


// text covered by something painted on top of it (diagram/shape/image over text)
texts.forEach(function(t){
  var el = document.querySelector('[data-v3-text="'+t.id+'"]'); if (!el) return;
  var hits = 0, tries = 0, by = '';
  for (var gx=1; gx<=6; gx++) for (var gy=1; gy<=2; gy++){
    var px = SR.left + t.x + t.w*gx/7, py = SR.top + t.y + t.h*gy/3; tries++;
    var e = document.elementFromPoint(px, py); if (!e) continue;
    if (e === el || el.contains(e) || e.contains(el)) continue;
    if (e.hasAttribute('data-v3-text') || e.hasAttribute('data-v3-inl')) { continue; }
    var es = cs(e);
    var paints = alphaOf(es.backgroundColor) > 0.3 || es.backgroundImage !== 'none' || /^(IMG|svg|SVG|CANVAS)$/.test(e.tagName) || !!e.closest('svg');
    if (paints && parseFloat(es.opacity) > 0.3) { hits++; by = e.closest('svg') ? 'a diagram/SVG' : e.tagName.toLowerCase(); }
  }
  if (hits >= 2) issues.push({type:'text-covered', severity:'high', detail:'Text "' + el.innerText.trim().slice(0,45) + '" is partly hidden under ' + by + ' drawn on top of it — move one of them so nothing overlaps.'});
});
// readable body size
texts.forEach(function(t){
  var el = document.querySelector('[data-v3-text="'+t.id+'"]'); if (!el) return;
  var txt = el.innerText.trim();
  if (t.words >= 7 && t.fontSize < 20 && !/^\s*\[\d+\]|https?:|doi|retrieved|wikipedia|credit|cc by|via wikimedia/i.test(txt)) issues.push({type:'small-body', severity: t.fontSize < 17 ? 'high' : 'medium', detail:'Body text "' + txt.slice(0,40) + '" is ' + Math.round(t.fontSize) + 'px — use 22–28px for sentences so the back row can read it.'});
});
// word-per-line wrapping (a column squeezed so narrow that each line holds one or two words)
texts.forEach(function(t){
  var el = document.querySelector('[data-v3-text="'+t.id+'"]'); if (!el || t.words < 6) return;
  var lh = parseFloat(getComputedStyle(el).lineHeight); if (!(lh > 0)) lh = t.fontSize * 1.25;
  var lines = Math.round(t.h / lh);
  if (lines >= 3 && t.words / lines < 2.5) issues.push({type:'narrow-text', severity:'high', detail:'Text "' + el.innerText.trim().slice(0,40) + '" wraps to ' + lines + ' lines of 1–2 words (its box is only ' + Math.round(t.w) + 'px wide) — give the column more width or use fewer columns.'});
});
// big decorative numbers / words must not sit on photos or other text
(function(){
  var imgs = images.map(function(i){return i;});
  SLIDE.querySelectorAll('*').forEach(function(el){ if (el.children.length) return; var cs = getComputedStyle(el); if (parseFloat(cs.fontSize) < 90 || !el.textContent.trim()) return;
    var r = el.getBoundingClientRect(); var x = r.left-SR.left, y = r.top-SR.top;
    imgs.forEach(function(i){ var ox = Math.min(x+r.width, i.x+i.w) - Math.max(x, i.x), oy = Math.min(y+r.height, i.y+i.h) - Math.max(y, i.y);
      if (ox > 20 && oy > 20 && ox*oy > 0.25*r.width*r.height) issues.push({type:'decor-overlap', severity:'medium', detail:'The big "' + el.textContent.trim().slice(0,12) + '" sits on top of a picture — move it off the photo or drop it.'}); }); });
})();
// how much of the canvas carries content
(function(){
  var g = 32, cells = {}, total = (1280/g)*(720/g);
  function mark(x,y,w,h){ for (var cx=Math.max(0,Math.floor(x/g)); cx<Math.min(1280/g, Math.ceil((x+w)/g)); cx++) for (var cy=Math.max(0,Math.floor(y/g)); cy<Math.min(720/g, Math.ceil((y+h)/g)); cy++) cells[cx+','+cy]=1; }
  texts.forEach(function(t){ mark(t.x,t.y,t.w,t.h); });
  images.forEach(function(i){ mark(i.x,i.y,i.w,i.h); });
  SLIDE.querySelectorAll('svg').forEach(function(sv){ if (sv.parentElement && sv.parentElement.closest('svg')) return; var r = sv.getBoundingClientRect(); if (r.width*r.height < 1280*720*0.8) mark(r.left-SR.left, r.top-SR.top, r.width, r.height); });
  // filled panels / cards / diagram nodes count as content too (a card is designed space, not an empty area)
  SLIDE.querySelectorAll('*').forEach(function(el){ if (el.closest('svg')) return; var r = el.getBoundingClientRect(); var a = r.width*r.height; if (a < 1280*720*0.01 || a > 1280*720*0.8) return;
    var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.2) return;
    var bg = cs.backgroundColor || ''; var m = bg.match(/rgba?\(([^)]+)\)/); var sl = bg.match(/\/\s*([\d.]+)\s*\)$/);
    var alpha = m ? (m[1].split(',')[3] !== undefined ? parseFloat(m[1].split(',')[3]) : 1) : sl ? parseFloat(sl[1]) : (!bg || bg === 'transparent' ? 0 : 1);
    var bordered = parseFloat(cs.borderTopWidth) >= 1 && parseFloat(cs.borderLeftWidth) >= 1 && cs.borderTopStyle !== 'none';
    if (alpha > 0.06 || cs.backgroundImage !== 'none' || bordered) mark(r.left-SR.left, r.top-SR.top, r.width, r.height); });
  var cov = Object.keys(cells).length / total;
  if (cov < 0.03) issues.push({type:'blank', severity:'high', detail:'The slide renders (almost) empty — the markup is broken or the content is hidden. Output a complete, visible slide.'});
  else if (cov < 0.28) issues.push({type:'sparse', severity:'medium', detail:'Only about ' + Math.round(cov*100) + '% of the slide carries content — large areas look unfinished. Make the visual larger, enlarge type, or rebalance the composition.'});
})();

// background-image urls that failed (cannot detect load directly) — check unresolved asset refs
if (/asset:/.test(SLIDE.innerHTML)) issues.push({type:'unknown-asset', severity:'high', detail:'An asset id that does not exist was referenced. Use only the listed asset ids.'});
var totalWords = texts.reduce(function(s,t){ return s + t.words; }, 0);
if (totalWords > 120) issues.push({type:'too-much-text', severity:'medium', detail:'The slide has about ' + totalWords + ' words — too dense for a class slide; tighten to the essentials.'});
ptr.remove();
return {texts: texts, images: images, issues: issues, words: totalWords};
})()`;

export const HIDE_JS = String.raw`(function(ids){
var st = document.createElement('style'); st.setAttribute('data-v3-hide-style','1');
st.textContent = '[data-v3-hidetext]{color:transparent !important;-webkit-text-fill-color:currentcolor !important;text-shadow:none !important;text-decoration-color:transparent !important;}'
 + '[data-v3-hidetext]::marker{color:var(--v3c) !important;}'
 + '[data-v3-hidetext]::before,[data-v3-hidetext]::after{color:var(--v3c) !important;-webkit-text-fill-color:currentcolor !important;}'
 + '[data-v3-hideimg]{visibility:hidden !important;}';
document.head.appendChild(st);
ids.texts.forEach(function(id){ var el = document.querySelector('[data-v3-text="'+id+'"]'); if(!el) return;
  // inline !important beats any stylesheet rule the designer wrote (even its own !important)
  function hide(e){ e.style.setProperty('--v3c', getComputedStyle(e).color); e.setAttribute('data-v3-hidetext','1');
    e.setAttribute('data-v3-prevcolor', e.style.getPropertyValue('color') + '|' + e.style.getPropertyPriority('color'));
    e.style.setProperty('color', 'transparent', 'important'); }
  hide(el);
  el.querySelectorAll('[data-v3-inl]').forEach(function(c){ if (c.closest('[data-v3-text]') === el) hide(c); });
});
ids.images.forEach(function(id){ var el = document.querySelector('[data-v3-img="'+id+'"]'); if (el) el.setAttribute('data-v3-hideimg','1'); });
return true;
})`;

export const UNHIDE_JS = String.raw`(function(){
document.querySelectorAll('[data-v3-hide-style]').forEach(function(e){ e.remove(); });
document.querySelectorAll('[data-v3-hidetext]').forEach(function(e){ e.removeAttribute('data-v3-hidetext');
  var pv = (e.getAttribute('data-v3-prevcolor') || '|').split('|'); e.removeAttribute('data-v3-prevcolor');
  if (pv[0]) e.style.setProperty('color', pv[0], pv[1] || ''); else e.style.removeProperty('color'); });
document.querySelectorAll('[data-v3-hideimg]').forEach(function(e){ e.removeAttribute('data-v3-hideimg'); });
return true; })()`;

/** Shrink text blocks flagged as clipped / out of canvas, in 8% steps (max 3), never below 16px body / 30px headings. */
export const SHRINK_JS = String.raw`(function(ids){
var changed = [];
ids.forEach(function(id){ var el = document.querySelector('[data-v3-text="'+id+'"]'); if(!el) return;
  var fs = parseFloat(getComputedStyle(el).fontSize); var min = /^H[1-3]$/.test(el.tagName) ? 30 : 16;
  var nfs = Math.max(min, Math.floor(fs * 0.9));
  if (nfs < fs) { el.style.fontSize = nfs + 'px'; el.querySelectorAll('*').forEach(function(c){ var cf = parseFloat(getComputedStyle(c).fontSize); if (cf > nfs * 1.05 || c.style.fontSize) c.style.fontSize = Math.max(12, Math.floor(cf * 0.9)) + 'px'; }); changed.push(id + ':' + fs + '→' + nfs); }
});
return changed;
})`;

export const SERIALIZE_JS = String.raw`(function(){
var s = document.querySelector('section.slide').cloneNode(true);
s.querySelectorAll('[data-v3-text],[data-v3-img],[data-v3-inl],[data-v3-svgt]').forEach(function(e){ e.removeAttribute('data-v3-text'); e.removeAttribute('data-v3-img'); e.removeAttribute('data-v3-inl'); e.removeAttribute('data-v3-svgt'); });
// drawn component layers are regenerated on every load — never store them
s.querySelectorAll('figure.v3-diagram > .v3d').forEach(function(e){ e.remove(); });
// engine v4 icons are re-expanded on every render — store the compact placeholder
s.querySelectorAll('[data-ic-x]').forEach(function(e){ e.innerHTML = ''; e.removeAttribute('data-ic-x'); var st = e.getAttribute('style'); if (st){ st = st.replace(/--ic-(size|color):[^;]*;?/g, '').trim(); if (st) e.setAttribute('style', st); else e.removeAttribute('style'); } });
return s.innerHTML;
})()`;

/** Push the lower of two overlapping text groups down (moving its positioned container), if it still fits on the canvas. */
export const NUDGE_JS = String.raw`(function(pairs){
var SR = document.querySelector('section.slide').getBoundingClientRect(); var done = [];
function box(el){ var r = el.getBoundingClientRect(); return {top:r.top-SR.top, bottom:r.bottom-SR.top}; }
function container(el){ var p = el; while (p && p.tagName !== 'SECTION'){ var pos = getComputedStyle(p).position; if (pos === 'absolute' || pos === 'fixed') return p; p = p.parentElement; } return null; }
pairs.forEach(function(pr){ var a = document.querySelector('[data-v3-text="'+pr[0]+'"]'), b = document.querySelector('[data-v3-text="'+pr[1]+'"]'); if (!a || !b) return;
  var ca = container(a), cb = container(b); if (!cb || cb === ca || cb.contains(a)) return;
  var delta = box(a).bottom - box(b).top + 18; if (delta <= 0) return;
  var cbB = box(cb); if (cbB.bottom + delta > 712) return;
  var top = parseFloat(getComputedStyle(cb).top); if (isNaN(top)) return;
  cb.style.top = (top + delta) + 'px'; done.push(pr[1] + '+' + Math.round(delta) + 'px'); });
return done; })`;


/**
 * Long URLs / DOIs / unbreakable tokens: wrap them in a span that may break anywhere, so they wrap inside their column
 * instead of pushing a grid/flex column (and its text) out of the panel. Ordinary words are left alone (a long word in
 * a heading is reported as "wider than its box" and fixed by size instead of breaking mid-word).
 */
export const WRAP_JS = String.raw`(function(){
var SLIDE = document.querySelector('section.slide'); if (!SLIDE) return [];
var RE = /(https?:\/\/[^\s<>"]{6,}|www\.[^\s<>"]{6,}|doi:\s?[^\s<>"]{6,}|\b10\.\d{4,9}\/[^\s<>"]{4,}|[^\s<>"]{30,})/g;
var done = [], nodes = [];
var tw = document.createTreeWalker(SLIDE, NodeFilter.SHOW_TEXT, null), n;
while ((n = tw.nextNode())){
  var pe = n.parentElement; if (!pe || pe.closest('svg,style,script,.v3-wrap,[data-v3-engine]')) continue;
  if (/\S{20,}/.test(n.textContent)) nodes.push(n);
}
nodes.forEach(function(n){
  var t = n.textContent, last = 0, frag = document.createDocumentFragment(), hit = false, m;
  RE.lastIndex = 0;
  while ((m = RE.exec(t))){
    if (m[0].length < 20) continue;
    hit = true;
    if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
    var s = document.createElement('span'); s.className = 'v3-wrap'; s.setAttribute('style', 'overflow-wrap:anywhere;');
    s.textContent = m[0]; frag.appendChild(s); last = m.index + m[0].length;
    done.push('wrap "' + m[0].slice(0, 32) + (m[0].length > 32 ? '…' : '') + '"');
  }
  if (!hit) return;
  if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
  n.parentNode.replaceChild(frag, n);
});
return done;
})()`;

/**
 * Low-contrast autofix (after the AI rounds): per text block either switch the text to the readable ink (white or
 * near-black, whichever reads best on what is behind it) or, when the background is too busy for any ink, put a
 * scrim plate behind the text (box-shadow spread, so the layout does not move).
 */
export const CONTRAST_FIX_JS = String.raw`(function(fixes){
var out = [];
fixes.forEach(function(f){ var el = document.querySelector('[data-v3-text="'+f.id+'"]'); if (!el) return;
  if (f.mode === 'recolor'){
    el.style.setProperty('color', f.ink, 'important'); el.style.setProperty('-webkit-text-fill-color', f.ink, 'important');
    el.querySelectorAll('*').forEach(function(c){ if (!c.closest('svg')) { c.style.setProperty('color', f.ink, 'important'); c.style.setProperty('-webkit-text-fill-color', f.ink, 'important'); } });
    out.push('contrast: text ' + f.id + ' → ' + f.ink);
  } else {
    el.style.setProperty('color', f.ink, 'important'); el.style.setProperty('-webkit-text-fill-color', f.ink, 'important');
    el.querySelectorAll('*').forEach(function(c){ if (!c.closest('svg')) { c.style.setProperty('color', f.ink, 'important'); c.style.setProperty('-webkit-text-fill-color', f.ink, 'important'); } });
    el.style.setProperty('background-color', f.plate, 'important');
    el.style.setProperty('box-shadow', '0 0 0 10px ' + f.plate, 'important');
    el.style.setProperty('border-radius', '4px', 'important');
    el.style.setProperty('-webkit-box-decoration-break', 'clone'); el.style.setProperty('box-decoration-break', 'clone');
    out.push('contrast: scrim behind text ' + f.id);
  }
});
return out;
})`;
