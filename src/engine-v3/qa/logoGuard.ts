/**
 * Engine v3 — hard guard for the uploaded institution logo (runs inside the rendered slide, before measuring).
 * The logo is an identity mark, never a picture: whatever the designer AI wrote,
 *   - it is never a CSS background (background-image: url(logo.png) is removed),
 *   - on slides that do not carry it in their layout (everything but title/closing) the AI's own copy is removed —
 *     the engine's small corner logo (data-v3-engine="logo") is the only one,
 *   - where it is allowed it stays small (≤ maxW×maxH), fully opaque, uncropped (object-fit: contain), unfiltered.
 * Returns the list of fixes made (empty when the slide already follows the rules).
 */
export const LOGO_GUARD_JS = String.raw`(function(o){
var SLIDE = document.querySelector('section.slide'); if (!SLIDE) return [];
var fixes = [];
function isLogo(u){ return /(^|[\/"'(])logo\.png/i.test(u || ''); }
function engine(e){ return !!(e.closest && e.closest('[data-v3-engine]')); }
var all = SLIDE.querySelectorAll('*');
for (var i = 0; i < all.length; i++){ var e = all[i]; if (engine(e)) continue;
  var bg = getComputedStyle(e).backgroundImage;
  if (bg && bg !== 'none' && isLogo(bg)){
    var layers = bg.split(/,(?![^(]*\))/).filter(function(l){ return !isLogo(l); });
    e.style.setProperty('background-image', layers.length ? layers.join(',') : 'none', 'important');
    fixes.push('logo used as background → removed');
  }
  ['::before','::after'].forEach(function(ps){ var pb = getComputedStyle(e, ps).backgroundImage; if (pb && pb !== 'none' && isLogo(pb)) { e.setAttribute('data-v3-nologo-' + (ps === '::before' ? 'b' : 'a'), '1'); fixes.push('logo used as decoration → removed'); } });
}
if (SLIDE.querySelector('[data-v3-nologo-b],[data-v3-nologo-a]')) { var st = document.createElement('style'); st.textContent = '[data-v3-nologo-b]::before{background-image:none !important}[data-v3-nologo-a]::after{background-image:none !important}'; SLIDE.appendChild(st); }
var imgs = Array.prototype.slice.call(SLIDE.querySelectorAll('img')).filter(function(im){ return !engine(im) && isLogo(im.getAttribute('src')); });
function cumOp(el){ var op = 1, p = el; while (p && p !== SLIDE){ op *= parseFloat(getComputedStyle(p).opacity); p = p.parentElement; } return op; }
function drop(im, why){ var p = im.parentElement; im.remove();
  if (p && p !== SLIDE && !p.innerText.trim() && !p.querySelector('img,svg,figure,canvas')) p.remove();
  fixes.push(why); }
var kept = null;
imgs.forEach(function(im){
  var r = im.getBoundingClientRect();
  // used as a picture: big (hero / background / half-slide), or faded into a watermark
  var hero = r.width * r.height > 1280 * 720 * 0.06 || r.width > 420 || r.height > 300 || cumOp(im) < 0.5;
  if (!o.allowed) return drop(im, 'logo removed (the engine places the small corner logo on this slide)');
  if (hero) return drop(im, 'logo used as a hero/background picture (' + Math.round(r.width) + '×' + Math.round(r.height) + ') → removed');
  if (kept) return drop(im, 'duplicate logo removed');
  kept = im;
});
if (kept){
  var im = kept, r = im.getBoundingClientRect(), s = getComputedStyle(im), what = [];
  if (r.width > o.maxW + 2 || r.height > o.maxH + 2){
    var k2 = Math.min(o.maxW / Math.max(1, r.width), o.maxH / Math.max(1, r.height));
    im.style.setProperty('width', Math.round(r.width * k2) + 'px', 'important');
    im.style.setProperty('height', Math.round(r.height * k2) + 'px', 'important');
    what.push('smaller');
  }
  if (s.objectFit !== 'contain' && s.objectFit !== 'scale-down'){ im.style.setProperty('object-fit', 'contain', 'important'); what.push('uncropped'); }
  if (cumOp(im) < 0.9){ var p2 = im; while (p2 && p2 !== SLIDE){ if (parseFloat(getComputedStyle(p2).opacity) < 1 && (p2 === im || p2.querySelectorAll('img').length === 1)) p2.style.setProperty('opacity', '1', 'important'); p2 = p2.parentElement; } what.push('full opacity'); }
  if ((s.filter !== 'none' && !/^drop-shadow/.test(s.filter)) || s.mixBlendMode !== 'normal'){ im.style.setProperty('filter', 'none', 'important'); im.style.setProperty('mix-blend-mode', 'normal', 'important'); what.push('no filter'); }
  if (what.length) fixes.push('logo kept clear: ' + what.join(', '));
} else if (o.allowed && imgs.length){
  // the title/closing slide lost its only (misused) logo: put it back small in the top-right corner
  var d = document.createElement('div');
  d.setAttribute('data-v3-logo', 'corner');
  d.setAttribute('style', 'position:absolute;right:40px;top:32px;z-index:50;background:#ffffff;border-radius:8px;padding:6px 8px;box-shadow:0 1px 4px rgba(0,0,0,.18);line-height:0;');
  var ni = document.createElement('img'); ni.setAttribute('src', imgs[0].getAttribute('src')); ni.setAttribute('alt', 'Institution logo');
  ni.setAttribute('style', 'display:block;max-width:150px;max-height:84px;width:auto;height:auto;object-fit:contain;');
  d.appendChild(ni); SLIDE.appendChild(d);
  fixes.push('logo placed small in the top-right corner');
}
return fixes;
})`;

/** Largest the logo may be drawn on the title/closing slide. */
export const LOGO_MAX = { w: 220, h: 140 };
