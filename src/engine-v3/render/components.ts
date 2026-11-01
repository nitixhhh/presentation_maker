/**
 * Engine v3 — diagram/chart components the AI designer can invoke (a designer's toolkit, not layouts).
 * The designer decides WHERE and HOW BIG (position/size of the <figure>) and WHAT (kind + items);
 * this engine-owned script draws a clean, on-brand diagram that fills that box. Labels stay HTML → editable in PPTX.
 *
 *   <figure class="v3-diagram" data-kind="flow|cycle|hub|layers|timeline|bars|compare|tree|matrix|sequence|line|donut|stacked" style="position:absolute;left:..;top:..;width:..;height:..">
 *     <li>Title: short description</li> …        (bars: <li data-value="42">Label</li>, hub: first <li> is the centre)
 *   engine v4 extras: tree (<li data-parent="Parent title">), matrix (4 quadrants; figure data-x / data-y axis names),
 *   sequence (figure data-actors="A|B"; <li data-from="A" data-to="B">message</li>), line / donut (<li data-value>),
 *   stacked (figure data-series="A|B"; <li data-values="3,5">Category</li>); an <i data-icon> inside an <li> is drawn in its node.
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
.v3d-ic{display:flex;align-items:center;justify-content:center;color:var(--primary);flex:none}
.v3d-centre .v3d-ic{color:var(--bg)}
.v3d-hl{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 35%,transparent),0 6px 18px color-mix(in srgb,var(--ink) 10%,transparent)}
.v3d-quad{position:absolute;border-radius:18px;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:14px 18px;background:color-mix(in srgb,var(--primary) 9%,var(--surface));border:2px solid color-mix(in srgb,var(--primary) 30%,transparent)}
.v3d-quad h4{margin:0;font-family:var(--font-heading);font-weight:700;color:var(--ink);line-height:1.15}
.v3d-quad p{margin:0;color:var(--muted);line-height:1.3}
.v3d-actor{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:12px;background:var(--primary);padding:6px 10px}
.v3d-actor h4{margin:0;color:var(--bg);font-family:var(--font-heading);font-weight:700;line-height:1.1}
.v3d-legend{position:absolute;display:flex;flex-direction:column;gap:10px}
.v3d-legend p{margin:0;display:flex;align-items:center;gap:10px;color:var(--ink);line-height:1.2}
.v3d-sw{display:inline-block;flex:none;border-radius:4px}
`;

export const COMPONENTS_JS = String.raw`(function(){
function items(fig){ var lis = fig.querySelectorAll(':scope > li, :scope > ul > li, :scope > ol > li'); var out = [];
  lis.forEach(function(li){ var strong = li.querySelector('strong,b'); var t = li.textContent.trim(); var title = t, desc = '';
    if (strong){ title = strong.textContent.trim().replace(/[:\-–—]\s*$/,''); desc = t.slice(strong.textContent.length).replace(/^\s*[:\-–—]\s*/,''); }
    else { var m = t.match(/^([^:–—]{2,60})[:–—]\s*(.+)$/); if (m){ title = m[1].trim(); desc = m[2].trim(); } }
    var ic = li.querySelector('[data-icon]');
    out.push({title: title, desc: desc, value: parseFloat(li.getAttribute('data-value')), unit: li.getAttribute('data-unit') || '', parent: li.getAttribute('data-parent') || '', from: li.getAttribute('data-from') || '', to: li.getAttribute('data-to') || '', values: (li.getAttribute('data-values') || '').split(/[,|]/).map(function(v){ return parseFloat(v); }).filter(function(v){ return !isNaN(v); }), icon: ic, hl: li.hasAttribute('data-highlight')}); });
  return out; }
function el(tag, cls, parent){ var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
function node(layer, it, x, y, w, h, fs, i, opts){ var n = el('div', 'v3d-node' + (opts && opts.centre ? ' v3d-centre' : ''), layer);
  n.style.left = x + 'px'; n.style.top = y + 'px'; n.style.width = w + 'px'; n.style.height = h + 'px';
  if (opts && opts.align) n.style.alignItems = opts.align; if (opts && opts.center) { n.style.textAlign = 'center'; n.style.alignItems = 'center'; }
  if (it.icon && !(opts && opts.noIcon)){ var icw = el('div', 'v3d-ic', n); var ics = Math.round(Math.max(30, Math.min(fs * 2, h * 0.4))); icw.style.width = icw.style.height = ics + 'px'; var cl = it.icon.cloneNode(true); cl.style.width = cl.style.height = ics + 'px'; icw.appendChild(cl); if (opts && opts.center) icw.style.alignSelf = 'center'; }
  if (it.hl) n.classList.add('v3d-hl');
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
  } else if (kind === 'tree' || kind === 'hierarchy' || kind === 'org'){
    var byT = {}; its.forEach(function(x, i){ x.kids = []; x.i = i; byT[x.title.toLowerCase()] = x; });
    var roots = [];
    its.forEach(function(x){ var p = x.parent && byT[x.parent.toLowerCase()]; if (p && p !== x) p.kids.push(x); else roots.push(x); });
    var root = roots[0]; for (var rr=1; rr<roots.length; rr++) root.kids.push(roots[rr]);
    var levels = []; (function walk(x, d){ (levels[d] = levels[d] || []).push(x); x.d = d; x.kids.forEach(function(k){ walk(k, d+1); }); })(root, 0);
    function leaves(x){ return x.kids.length ? x.kids.reduce(function(a, k){ return a + leaves(k); }, 0) : 1; }
    var L = levels.length, nl = leaves(root); var vgap = Math.max(34, H*0.09); var th = Math.min((H - vgap*(L-1))/L, fs*4.2); var hgap = Math.max(14, W*0.02);
    var tw = Math.min(300, (W - hgap*(nl-1))/nl); var ts = svg(layer, W, H); var tvTop = (H - (th*L + vgap*(L-1)))/2;
    (function place(x, x0, x1){ var cx2 = (x0 + x1)/2; x.cx = cx2; x.cy = tvTop + x.d*(th+vgap); var acc = x0; var tot = leaves(x);
      x.kids.forEach(function(k){ var span = (x1 - x0) * leaves(k)/tot; place(k, acc, acc + span); acc += span; }); })(root, 0, W);
    its.forEach(function(x){ if (x.d === undefined) return; x.kids.forEach(function(k){ var pth = document.createElementNS('http://www.w3.org/2000/svg','path'); var my = x.cy + th + vgap/2;
      pth.setAttribute('d', 'M'+x.cx+','+(x.cy+th)+' V'+my+' H'+k.cx+' V'+(k.cy-2)); pth.setAttribute('fill','none'); pth.setAttribute('stroke','var(--accent)'); pth.setAttribute('stroke-width','3'); pth.setAttribute('stroke-linejoin','round'); ts.appendChild(pth); }); });
    its.forEach(function(x){ if (x.d === undefined) return; var nwx = x.d === 0 ? Math.min(W*0.4, Math.max(tw, 260)) : tw; node(layer, x, x.cx - nwx/2, x.cy, nwx, th, x.d === 0 ? fs*1.05 : fs, x.i, {center:true, centre: x.d === 0}); });
  } else if (kind === 'matrix' || kind === 'quadrant' || kind === '2x2'){
    var xl = fig.getAttribute('data-x') || '', yl = fig.getAttribute('data-y') || ''; var top = yl ? fs*1.8 : 0, bot = xl ? fs*1.8 : 0; var g2 = Math.max(12, W*0.015);
    var qw = (W - g2)/2, qh = (H - top - bot - g2)/2;
    for (var qi=0; qi<Math.min(4,n); qi++){ var qx = (qi%2)*(qw+g2), qy = top + Math.floor(qi/2)*(qh+g2); var qd = el('div','v3d-quad' + (its[qi].hl ? ' v3d-hl' : ''), layer); qd.style.left = qx+'px'; qd.style.top = qy+'px'; qd.style.width = qw+'px'; qd.style.height = qh+'px';
      if (its[qi].icon){ var qic = el('div','v3d-ic',qd); var qs = Math.round(Math.max(26, Math.min(fs*1.6, qh*0.3))); qic.style.width = qic.style.height = qs+'px'; qic.style.alignSelf='flex-start'; var qcl = its[qi].icon.cloneNode(true); qcl.style.width = qcl.style.height = qs+'px'; qic.appendChild(qcl); }
      var qh4 = el('h4','',qd); qh4.textContent = its[qi].title; qh4.style.fontSize = Math.round(fs)+'px'; if (its[qi].desc){ var qp = el('p','',qd); qp.textContent = its[qi].desc; qp.style.fontSize = Math.round(Math.max(17, fs*0.8))+'px'; } }
    var ms = svg(layer, W, H);
    if (yl){ var yt = el('p','v3d-label',layer); yt.textContent = '↑ ' + yl; yt.style.left='0px'; yt.style.top='0px'; yt.style.fontSize = Math.round(fs*0.8)+'px'; yt.style.fontWeight='700'; yt.style.color='var(--muted)'; }
    if (xl){ var xt = el('p','v3d-label',layer); xt.textContent = xl + ' →'; xt.style.right='0px'; xt.style.bottom='0px'; xt.style.fontSize = Math.round(fs*0.8)+'px'; xt.style.fontWeight='700'; xt.style.color='var(--muted)'; xt.style.textAlign='right'; }
  } else if (kind === 'sequence'){
    var acts = (fig.getAttribute('data-actors') || '').split('|').map(function(a){ return a.trim(); }).filter(Boolean);
    its.forEach(function(m2){ [m2.from, m2.to].forEach(function(a){ if (a && acts.indexOf(a) < 0) acts.push(a); }); });
    var na = Math.max(1, acts.length); var aw = Math.min(220, W/na - 20), ah = Math.max(fs*2.2, 44); var colW2 = W/na; var ss = svg(layer, W, H);
    var axs = acts.map(function(a, i){ var ax = colW2*i + colW2/2; var ad = el('div','v3d-actor',layer); ad.style.left = (ax-aw/2)+'px'; ad.style.top='0px'; ad.style.width=aw+'px'; ad.style.height=ah+'px'; var ah4 = el('h4','',ad); ah4.textContent = a; ah4.style.fontSize = Math.round(fs*0.95)+'px';
      line(ss, ax, ah+4, ax, H, false, true); return ax; });
    var rowH2 = (H - ah - 16) / Math.max(1, n);
    for (var si=0; si<n; si++){ var m3 = its[si]; var fa = acts.indexOf(m3.from), ta = acts.indexOf(m3.to); if (fa < 0 || ta < 0) continue; var yy = ah + 16 + rowH2*si + rowH2*0.62;
      var x1s = axs[fa], x2s = axs[ta];
      if (fa === ta){ var lp = document.createElementNS('http://www.w3.org/2000/svg','path'); lp.setAttribute('d','M'+x1s+','+(yy-14)+' h46 v28 h-40'); lp.setAttribute('fill','none'); lp.setAttribute('stroke','var(--accent)'); lp.setAttribute('stroke-width','3'); lp.setAttribute('marker-end','url(#v3arrow)'); ss.appendChild(lp); }
      else line(ss, x1s + (x2s > x1s ? 6 : -6), yy, x2s + (x2s > x1s ? -8 : 8), yy, true, m3.desc === 'reply');
      var lb = el('p','v3d-label',layer); lb.textContent = (m3.title || '') ; var lw = Math.max(120, Math.abs(x2s - x1s) - 16); lb.style.width = lw+'px'; lb.style.left = ((x1s + x2s)/2 - lw/2 + (fa === ta ? 60 : 0))+'px'; lb.style.top = (yy - fs*1.35 - 4)+'px'; lb.style.fontSize = Math.round(Math.max(16, fs*0.8))+'px'; lb.style.textAlign='center'; lb.style.color='var(--ink)'; }
  } else if (kind === 'line'){
    var lv = its.map(function(x){ return isNaN(x.value) ? 0 : x.value; }); var lmax = Math.max.apply(null, lv.concat([0])), lmin = Math.min.apply(null, lv.concat([0])); if (lmax === lmin) lmax = lmin + 1;
    var padL = 10, padB = fs*1.9, padT = fs*1.6; var pw = W - padL*2, ph = H - padB - padT; var ls = svg(layer, W, H);
    line(ls, padL, padT+ph, W-padL, padT+ph, false, false); ls.lastChild.setAttribute('stroke','color-mix(in srgb, var(--ink) 30%, transparent)');
    var pts = lv.map(function(v, i){ return [padL + (n === 1 ? pw/2 : pw*i/(n-1)), padT + ph - ph*(v - lmin)/(lmax - lmin)]; });
    var pl = document.createElementNS('http://www.w3.org/2000/svg','polyline'); pl.setAttribute('points', pts.map(function(p){ return p.join(','); }).join(' ')); pl.setAttribute('fill','none'); pl.setAttribute('stroke','var(--primary)'); pl.setAttribute('stroke-width','5'); pl.setAttribute('stroke-linejoin','round'); pl.setAttribute('stroke-linecap','round'); ls.appendChild(pl);
    var imax = lv.indexOf(Math.max.apply(null, lv));
    pts.forEach(function(p, i){ var c2 = document.createElementNS('http://www.w3.org/2000/svg','circle'); c2.setAttribute('cx',p[0]); c2.setAttribute('cy',p[1]); c2.setAttribute('r', i === imax || its[i].hl ? 10 : 7); c2.setAttribute('fill', i === imax || its[i].hl ? 'var(--accent)' : 'var(--primary)'); ls.appendChild(c2);
      var vl = el('p','v3d-label',layer); vl.textContent = String(its[i].value) + (its[i].unit || ''); vl.style.left = (p[0]-60)+'px'; vl.style.width='120px'; vl.style.textAlign='center'; vl.style.top = (p[1] - fs*1.5 - 6)+'px'; vl.style.fontSize = Math.round(fs*0.85)+'px'; vl.style.fontWeight='700';
      var xl2 = el('p','v3d-label',layer); xl2.textContent = its[i].title; var xw = Math.max(70, pw/Math.max(1,n) - 6); xl2.style.left = Math.max(0, Math.min(W - xw, p[0]-xw/2))+'px'; xl2.style.width = xw+'px'; xl2.style.textAlign='center'; xl2.style.top = (padT+ph+8)+'px'; xl2.style.fontSize = Math.round(Math.max(15, fs*0.75))+'px'; xl2.style.color='var(--muted)'; });
  } else if (kind === 'donut' || kind === 'pie'){
    var dv = its.map(function(x){ return isNaN(x.value) || x.value < 0 ? 0 : x.value; }); var tot2 = dv.reduce(function(a,b){ return a+b; }, 0) || 1;
    var cols2 = ['var(--primary)','var(--accent)','var(--accent2)','color-mix(in srgb, var(--primary) 55%, var(--bg))','color-mix(in srgb, var(--accent) 55%, var(--bg))','var(--muted)'];
    var D = Math.min(H, W*0.5); var R = D/2 - 14, sw2 = Math.max(26, R*0.36); var dcx = D/2, dcy = H/2; var dsv = svg(layer, W, H); var Cc = 2*Math.PI*(R - sw2/2); var off = 0;
    dv.forEach(function(v, i){ var seg = document.createElementNS('http://www.w3.org/2000/svg','circle'); seg.setAttribute('cx',dcx); seg.setAttribute('cy',dcy); seg.setAttribute('r', R - sw2/2); seg.setAttribute('fill','none'); seg.setAttribute('stroke', cols2[i % cols2.length]); seg.setAttribute('stroke-width', sw2); var len = Cc*v/tot2; seg.setAttribute('stroke-dasharray', Math.max(0, len - 3) + ' ' + (Cc - Math.max(0, len - 3))); seg.setAttribute('stroke-dashoffset', -off); seg.setAttribute('transform','rotate(-90 '+dcx+' '+dcy+')'); dsv.appendChild(seg); off += len; });
    var lg = el('div','v3d-legend',layer); lg.style.left = (D + 30)+'px'; lg.style.top='0px'; lg.style.width = (W - D - 30)+'px'; lg.style.height = H+'px'; lg.style.justifyContent='center';
    its.forEach(function(x, i){ var lp2 = el('p','',lg); lp2.style.fontSize = Math.round(fs*0.9)+'px'; var sw3 = el('span','v3d-sw',lp2); sw3.style.width = sw3.style.height = Math.round(fs*0.8)+'px'; sw3.style.background = cols2[i % cols2.length]; var st2 = el('strong','',lp2); st2.textContent = String(x.value) + (x.unit || ''); var sp2 = el('span','',lp2); sp2.textContent = x.title; });
  } else if (kind === 'stacked'){
    var ser = (fig.getAttribute('data-series') || '').split('|').map(function(a){ return a.trim(); }).filter(Boolean);
    var cols3 = ['var(--primary)','var(--accent)','var(--accent2)','color-mix(in srgb, var(--primary) 50%, var(--bg))','var(--muted)'];
    var tots = its.map(function(x){ return x.values.reduce(function(a,b){ return a+b; }, 0); }); var smax = Math.max.apply(null, tots.concat([1]));
    var legH = ser.length ? fs*1.8 : 0; var lab2 = W*0.28; var rh2 = (H - legH)/Math.max(1,n);
    if (ser.length){ var lg2 = el('div','v3d-legend',layer); lg2.style.flexDirection='row'; lg2.style.flexWrap='wrap'; lg2.style.left = lab2+'px'; lg2.style.top='0px'; lg2.style.gap='18px';
      ser.forEach(function(sn, i){ var lp3 = el('p','',lg2); lp3.style.fontSize = Math.round(fs*0.8)+'px'; var sw4 = el('span','v3d-sw',lp3); sw4.style.width = sw4.style.height = Math.round(fs*0.7)+'px'; sw4.style.background = cols3[i % cols3.length]; var t4 = el('span','',lp3); t4.textContent = sn; }); }
    its.forEach(function(x, b){ var yb = legH + b*rh2 + rh2*0.18, hb = rh2*0.64; var lab3 = el('p','v3d-label',layer); lab3.textContent = x.title; lab3.style.left='0px'; lab3.style.width=(lab2-14)+'px'; lab3.style.textAlign='right'; lab3.style.top = (yb + hb/2 - fs*0.62)+'px'; lab3.style.fontSize = Math.round(fs*0.9)+'px';
      var acc2 = lab2; x.values.forEach(function(v, k){ var wseg = (W - lab2 - 80) * v/smax; var sg = el('div','v3d-bar',layer); sg.style.left = acc2+'px'; sg.style.top = yb+'px'; sg.style.width = Math.max(2, wseg - 2)+'px'; sg.style.height = hb+'px'; sg.style.borderRadius='6px'; sg.style.background = cols3[k % cols3.length]; acc2 += wseg; });
      var tv = el('p','v3d-label',layer); tv.textContent = String(tots[b]) + (x.unit || ''); tv.style.left = (acc2 + 10)+'px'; tv.style.top = (yb + hb/2 - fs*0.62)+'px'; tv.style.fontSize = Math.round(fs*0.9)+'px'; tv.style.fontWeight='700'; });
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
  var floor = (fig.getAttribute('data-kind') || '') === 'cycle' ? 18 : 16;
  for (var k=0; k<8 && !fits(layer) && fs > floor; k++){ fs = Math.max(floor, fs * 0.9); layer = draw(fig, fs); }
});
})();`;
