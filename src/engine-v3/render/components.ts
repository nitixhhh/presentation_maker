/**
 * Engine v3 — diagram/chart components the AI designer can invoke (a designer's toolkit, not layouts).
 * The designer decides WHERE and HOW BIG (position/size of the <figure>) and WHAT (kind + items);
 * this engine-owned script draws a clean, on-brand diagram that fills that box. Labels stay HTML → editable in PPTX.
 *
 *   <figure class="v3-diagram" data-kind="flow|cycle|hub|layers|timeline|bars|compare" style="position:absolute;left:..;top:..;width:..;height:..">
 *     <li>Title: short description</li> …        (bars: <li data-value="42">Label</li>, hub: first <li> is the centre)
 *   </figure>
 */
export const COMPONENTS_CSS = `
.v3-diagram{margin:0;padding:0;list-style:none;}
.v3-diagram > li{display:none}
.v3d{position:absolute;inset:0;font-family:var(--font-body);color:var(--ink)}
.v3d-node{position:absolute;display:flex;flex-direction:column;justify-content:center;gap:4px;background:var(--surface);border:2px solid color-mix(in srgb,var(--primary) 70%,transparent);border-radius:16px;padding:10px 14px;box-shadow:0 6px 18px color-mix(in srgb,var(--ink) 10%,transparent)}
.v3d-node h4{margin:0;font-family:var(--font-heading);font-weight:700;color:var(--ink);line-height:1.15}
.v3d-node p{margin:0;color:var(--muted);line-height:1.3}
.v3d-badge{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--accent);color:var(--bg);font-family:var(--font-heading);font-weight:800}
.v3d-centre{background:var(--primary);border-color:var(--primary)}
.v3d-centre h4,.v3d-centre p{color:var(--bg)}
.v3d-bar-track{position:absolute;border-radius:10px;background:color-mix(in srgb,var(--primary) 12%,transparent)}
.v3d-bar{position:absolute;border-radius:10px;background:var(--primary)}
.v3d-label{position:absolute;margin:0;line-height:1.2}
`;

export const COMPONENTS_JS = String.raw`(function(){
function items(fig){ var lis = fig.querySelectorAll(':scope > li, :scope > ul > li, :scope > ol > li'); var out = [];
  lis.forEach(function(li){ var strong = li.querySelector('strong,b'); var t = li.textContent.trim(); var title = t, desc = '';
    if (strong){ title = strong.textContent.trim().replace(/[:\-–—]\s*$/,''); desc = t.slice(strong.textContent.length).replace(/^\s*[:\-–—]\s*/,''); }
    else { var m = t.match(/^([^:–—]{2,60})[:–—]\s*(.+)$/); if (m){ title = m[1].trim(); desc = m[2].trim(); } }
    out.push({title: title, desc: desc, value: parseFloat(li.getAttribute('data-value')), unit: li.getAttribute('data-unit') || ''}); });
  return out; }
function el(tag, cls, parent){ var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
function node(layer, it, x, y, w, h, fs, i, opts){ var n = el('div', 'v3d-node' + (opts && opts.centre ? ' v3d-centre' : ''), layer);
  n.style.left = x + 'px'; n.style.top = y + 'px'; n.style.width = w + 'px'; n.style.height = h + 'px';
  if (opts && opts.align) n.style.alignItems = opts.align; if (opts && opts.center) { n.style.textAlign = 'center'; n.style.alignItems = 'center'; }
  var h4 = el('h4', '', n); h4.textContent = it.title; h4.style.fontSize = Math.round(fs) + 'px';
  if (it.desc){ var p = el('p', '', n); p.textContent = it.desc; p.style.fontSize = Math.round(Math.max(14, fs * 0.72)) + 'px'; }
  if (opts && opts.badge){ var b = el('div', 'v3d-badge', n); var bs = Math.max(26, fs * 1.3); b.style.width = b.style.height = bs + 'px'; b.style.left = (-bs/2.4) + 'px'; b.style.top = (-bs/2.4) + 'px'; b.style.fontSize = Math.round(bs*0.5) + 'px'; b.textContent = String(i + 1); }
  return n; }
function svg(layer, W, H){ var s = document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('width', W); s.setAttribute('height', H); s.setAttribute('viewBox','0 0 '+W+' '+H); s.style.position='absolute'; s.style.left='0'; s.style.top='0'; s.style.overflow='visible';
  s.innerHTML = '<defs><marker id="v3arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker></defs>'; layer.appendChild(s); return s; }
function line(s, x1, y1, x2, y2, arrow, dash){ var l = document.createElementNS('http://www.w3.org/2000/svg','line'); l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2); l.setAttribute('stroke','var(--accent)'); l.setAttribute('stroke-width','3'); l.setAttribute('stroke-linecap','round'); if (dash) l.setAttribute('stroke-dasharray','6 7'); if (arrow) l.setAttribute('marker-end','url(#v3arrow)'); s.appendChild(l); }
function fits(layer){ var ok = true; layer.querySelectorAll('.v3d-node').forEach(function(n){ if (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2) ok = false; }); return ok; }

function draw(fig, fs){
  var W = fig.clientWidth, H = fig.clientHeight; var its = items(fig); var kind = (fig.getAttribute('data-kind') || 'flow').toLowerCase();
  var old = fig.querySelector(':scope > .v3d'); if (old) old.remove();
  var layer = el('div', 'v3d', fig); var n = its.length; if (!n || W < 40 || H < 40) return layer;
  if (kind === 'flow' || kind === 'process' || kind === 'steps'){
    var vertical = H > W * 0.9; var gap = vertical ? Math.max(26, H*0.06) : Math.max(34, W*0.045);
    var s = svg(layer, W, H);
    for (var i=0;i<n;i++){
      if (vertical){ var nh = (H - gap*(n-1))/n; var y = i*(nh+gap); node(layer, its[i], 14, y, W-14, nh, fs, i, {badge:true}); if (i<n-1) line(s, W/2, y+nh+3, W/2, y+nh+gap-4, true); }
      else { var nw = (W - gap*(n-1))/n; var x = i*(nw+gap); var nh2 = Math.min(H, Math.max(H*0.55, fs*5)); var y2 = (H-nh2)/2; node(layer, its[i], x, y2, nw, nh2, fs, i, {badge:true, center:true}); if (i<n-1) line(s, x+nw+4, H/2, x+nw+gap-4, H/2, true); }
    }
  } else if (kind === 'cycle'){
    var s2 = svg(layer, W, H); var cx = W/2, cy = H/2; var nw2 = Math.min(W*0.34, Math.max(150, W/(n>4?3.2:2.6))); var nh3 = Math.min(H*0.3, fs*4.2);
    var rx = (W - nw2)/2, ry = (H - nh3)/2;
    var c = document.createElementNS('http://www.w3.org/2000/svg','ellipse'); c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('rx',rx*0.92); c.setAttribute('ry',ry*0.92); c.setAttribute('fill','none'); c.setAttribute('stroke','color-mix(in srgb, var(--primary) 35%, transparent)'); c.setAttribute('stroke-width','3'); c.setAttribute('stroke-dasharray','8 8'); s2.appendChild(c);
    for (var k=0;k<n;k++){ var a = -Math.PI/2 + k*2*Math.PI/n; var x3 = cx + rx*Math.cos(a) - nw2/2, y3 = cy + ry*Math.sin(a) - nh3/2; node(layer, its[k], x3, y3, nw2, nh3, fs, k, {badge:true, center:true});
      var a2 = a + Math.PI/n; line(s2, cx + rx*0.92*Math.cos(a2-0.12), cy + ry*0.92*Math.sin(a2-0.12), cx + rx*0.92*Math.cos(a2+0.05), cy + ry*0.92*Math.sin(a2+0.05), true); }
  } else if (kind === 'hub' || kind === 'radial'){
    var s3 = svg(layer, W, H); var cw = Math.min(W*0.3, 300), ch = Math.min(H*0.3, fs*4.4); var ccx = W/2, ccy = H/2; var rest = its.slice(1); var m = rest.length;
    var nw4 = Math.min(W*0.28, 280), nh4 = Math.min(H*0.24, fs*4); var rx2 = (W - nw4)/2, ry2 = (H - nh4)/2;
    for (var q=0;q<m;q++){ var ang = -Math.PI/2 + q*2*Math.PI/m; var px = ccx + rx2*Math.cos(ang), py = ccy + ry2*Math.sin(ang); line(s3, ccx, ccy, px, py, false, true); }
    node(layer, its[0], ccx-cw/2, ccy-ch/2, cw, ch, fs*1.1, 0, {centre:true, center:true});
    for (var q2=0;q2<m;q2++){ var ang2 = -Math.PI/2 + q2*2*Math.PI/m; node(layer, rest[q2], ccx + rx2*Math.cos(ang2) - nw4/2, ccy + ry2*Math.sin(ang2) - nh4/2, nw4, nh4, fs, q2, {center:true}); }
  } else if (kind === 'layers' || kind === 'stack' || kind === 'architecture'){
    var g = Math.max(10, H*0.025); var lh = (H - g*(n-1))/n;
    for (var j=0;j<n;j++){ var inset = 0; var nd = node(layer, its[j], inset, j*(lh+g), W-2*inset, lh, fs, j, {});
      nd.style.flexDirection = 'row'; nd.style.alignItems = 'center'; nd.style.justifyContent = 'flex-start'; nd.style.gap = '18px';
      nd.style.background = 'color-mix(in srgb, var(--primary) ' + Math.round(10 + 70*(j/(Math.max(1,n-1)))) + '%, var(--surface))';
      var dark = j/(Math.max(1,n-1)) > 0.5; nd.querySelectorAll('h4,p').forEach(function(t){ t.style.color = dark ? 'var(--bg)' : ''; });
      var h4b = nd.querySelector('h4'); if (h4b) { h4b.style.flex = '0 0 32%'; } }
  } else if (kind === 'timeline'){
    var s4 = svg(layer, W, H); var y0 = H/2; line(s4, 0, y0, W, y0, true); var step = W/n; var bw = Math.min(step*0.92, 320), bh = Math.min(H*0.4, fs*4.6);
    for (var t=0;t<n;t++){ var cxx = step*t + step/2; var dot = document.createElementNS('http://www.w3.org/2000/svg','circle'); dot.setAttribute('cx',cxx); dot.setAttribute('cy',y0); dot.setAttribute('r',9); dot.setAttribute('fill','var(--accent)'); s4.appendChild(dot);
      var up = t % 2 === 0; node(layer, its[t], cxx - bw/2, up ? y0 - bh - 22 : y0 + 22, bw, bh, fs, t, {center:true}); }
  } else if (kind === 'bars' || kind === 'chart' || kind === 'bar'){
    var vals = its.map(function(x){ return isNaN(x.value) ? 0 : x.value; }); var max = Math.max.apply(null, vals.concat([1])); var rowH = H/n; var labW = W*0.32;
    for (var b=0;b<n;b++){ var y5 = b*rowH + rowH*0.15, hh = rowH*0.7;
      var lab = el('p', 'v3d-label', layer); lab.textContent = its[b].title; lab.style.left='0px'; lab.style.top = (y5 + hh/2 - fs*0.62) + 'px'; lab.style.width = (labW-16) + 'px'; lab.style.fontSize = Math.round(fs) + 'px'; lab.style.textAlign='right';
      var tr = el('div','v3d-bar-track',layer); tr.style.left = labW + 'px'; tr.style.top = y5 + 'px'; tr.style.width = (W - labW - 90) + 'px'; tr.style.height = hh + 'px';
      var bar = el('div','v3d-bar',layer); bar.style.left = labW + 'px'; bar.style.top = y5 + 'px'; bar.style.width = Math.max(4, (W - labW - 90) * vals[b]/max) + 'px'; bar.style.height = hh + 'px'; if (b === vals.indexOf(max)) bar.style.background = 'var(--accent)';
      var v = el('p','v3d-label',layer); v.textContent = (isNaN(its[b].value) ? '' : String(its[b].value)) + (its[b].unit || ''); v.style.left = (labW + (W - labW - 90) * vals[b]/max + 10) + 'px'; v.style.top = (y5 + hh/2 - fs*0.62) + 'px'; v.style.fontSize = Math.round(fs) + 'px'; v.style.fontWeight = '700'; }
  } else if (kind === 'compare'){
    var half = Math.ceil(n/2), colW = (W - 30)/2; var rh = H / half;
    for (var cc=0; cc<n; cc++){ var col = cc < half ? 0 : 1; var row = col ? cc - half : cc; node(layer, its[cc], col*(colW+30), row*rh + 4, colW, rh - 10, fs, cc, {}); }
  }
  return layer;
}
document.querySelectorAll('figure.v3-diagram').forEach(function(fig){
  if (getComputedStyle(fig).position === 'static') fig.style.position = 'relative';
  var fs = parseFloat(fig.getAttribute('data-size')) || Math.max(18, Math.min(26, fig.clientWidth / 28));
  var layer = draw(fig, fs);
  for (var k=0; k<8 && !fits(layer) && fs > 15; k++){ fs = fs * 0.9; layer = draw(fig, fs); }
});
})();`;
