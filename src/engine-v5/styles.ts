/**
 * Engine v5 — the template stylesheet (shared by every template, themed only through CSS variables).
 * Type scale: --s (body scale, set by the auto-fit) and --ts (title scale). Floors are in the CSS itself:
 * body text never below 20px, labels never below 18px, whatever the fit does.
 */
export const V5_CSS = String.raw`
.slide .v5{position:absolute;inset:0;--s:1;--ts:1;
  --fz-body:max(20px,calc(var(--s) * 22px));--fz-h3:max(22px,calc(var(--s) * 27px));--fz-label:max(18px,calc(var(--s) * 19px));
  --fz-lede:max(20px,calc(var(--s) * 24px));--gap:calc(var(--s) * 26px);--pad:calc(var(--s) * 30px);
  display:flex;flex-direction:column;padding:56px 80px 60px 80px;color:var(--ink);font-family:var(--font-body);overflow:hidden}
.slide .v5 *{overflow-wrap:normal;word-break:normal;}
.slide .v5 .v5-refs li,.slide .v5 .v5-credits p{overflow-wrap:anywhere;}
.slide .v5-decor{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.slide .v5-decor > *{position:absolute}
.slide .v5 > :not(.v5-decor):not(.v5-photo-side):not(.v5-bgimg):not(.v5-scrim):not(.v5-foot):not(.v5-src){position:relative;z-index:1}
.slide .v5-head{flex:none;display:flex;flex-direction:column;gap:12px;max-width:1060px}
.slide .v5-eyebrow{display:flex;align-items:center;gap:12px;font-family:var(--font-body);font-weight:700;font-size:18px;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;color:var(--primary)}
.slide .v5-dark .v5-eyebrow,.slide .v5-on-hero .v5-eyebrow{color:var(--accent)}
.slide .v5-eyebrow::before{content:"";display:block;width:34px;height:4px;border-radius:2px;background:var(--accent);flex:none}
.slide .v5-title{font-family:var(--font-heading);font-weight:700;font-size:calc(var(--ts) * 50px);line-height:1.1;letter-spacing:-.012em;color:var(--ink);margin:0}
.slide .v5-lede{font-size:var(--fz-lede);line-height:1.4;color:var(--muted);margin:0;max-width:1000px}
.slide .v5-body{flex:1;min-height:0;margin-top:calc(var(--s) * 30px + 6px);display:flex;gap:var(--gap)}
.slide .v5-foot{position:absolute;left:80px;bottom:16px;z-index:1;display:flex;align-items:center;gap:12px;font-size:18px;line-height:1;letter-spacing:.06em;color:var(--muted);opacity:.85}
.slide .v5-foot b{color:var(--primary);font-weight:700}
.slide .v5-dark .v5-foot b{color:var(--accent)}
.slide .v5-foot .v5-dot{width:5px;height:5px;border-radius:50%;background:var(--accent);display:inline-block}
.slide .v5-cite{font-size:15px;color:var(--muted);letter-spacing:.02em}
.slide .v5-src{position:absolute;right:80px;bottom:16px;z-index:1;font-size:18px;line-height:1;color:var(--muted);max-width:560px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slide .v5-has-logo .v5-src{right:200px;max-width:440px}
/* cards & icons */
.slide .v5-card{position:relative;display:flex;flex-direction:column;gap:calc(var(--s) * 14px);padding:var(--pad);min-width:0;min-height:0;overflow:hidden}
.slide .v5-icbox{flex:none;display:flex;align-items:center;justify-content:center;width:calc(var(--s) * 66px);height:calc(var(--s) * 66px);border-radius:calc(var(--radius-sm) + 4px);background:var(--soft);color:var(--primary)}
.slide .v5-dark .v5-icbox{color:var(--accent)}
.slide .v5-icbox i[data-icon]{width:54%;height:54%;--ic-size:54%}
.slide .v5-h3{font-family:var(--font-heading);font-weight:700;font-size:var(--fz-h3);line-height:1.18;color:var(--ink);margin:0}
.slide .v5-p{font-size:var(--fz-body);line-height:1.42;color:var(--muted);margin:0}
.slide .v5-dark .v5-p{color:var(--muted)}
.slide .v5-num{font-family:var(--font-heading);font-weight:700;font-size:var(--fz-label);line-height:1;color:var(--accent);letter-spacing:.04em}
.slide .v5-grid{flex:1;min-width:0;display:grid;gap:var(--gap);grid-auto-rows:1fr}
.slide .v5-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.slide .v5-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.slide .v5-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.slide .v5-cardnum{position:absolute;top:calc(var(--s) * 24px);right:calc(var(--s) * 26px)}
.slide .v5-accent-top{border-top:5px solid var(--primary)}
.slide .v5-dark .v5-accent-top{border-top-color:var(--accent)}
/* photos */
.slide .v5-photo{position:relative;overflow:hidden;border-radius:var(--radius);min-height:0;min-width:0;background:color-mix(in srgb,var(--ink) 8%,transparent)}
.slide .v5-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.slide .v5-photo-side{position:absolute;top:0;bottom:0;right:0;width:44%;z-index:0;overflow:hidden}
.slide .v5-photo-side img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.slide .v5-photo-side::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,transparent 14%)}
.slide .v5-split-right{padding-right:calc(44% + 56px)}
.slide .v5-bgimg{position:absolute;inset:0;z-index:0}
.slide .v5-bgimg img{width:100%;height:100%;object-fit:cover;display:block}
.slide .v5-scrim{position:absolute;inset:0;z-index:0}
/* hero slides (title / section / closing) */
.slide .v5-hero{background:var(--hero);--ink:var(--hero-ink);--muted:var(--hero-muted)}
.slide .v5-hero .v5-title{color:var(--hero-ink)}
.slide .v5-hero-title{font-family:var(--font-heading);font-weight:800;font-size:calc(var(--ts) * 70px);line-height:1.05;letter-spacing:-.02em;margin:0;color:var(--ink)}
.slide .v5-hero-sub{font-size:max(20px,calc(var(--s) * 27px));line-height:1.35;color:var(--muted);margin:0}
.slide .v5-people{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 40px}
.slide .v5-people.v5-people-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.slide .v5-person{display:flex;flex-direction:column;gap:4px;min-width:0;border-left:3px solid var(--accent);padding-left:14px}
.slide .v5-person span{font-size:18px;line-height:1.2;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.slide .v5-person b{font-size:max(18px,calc(var(--s) * 21px));line-height:1.3;font-weight:600;color:var(--ink)}
/* lists */
.slide .v5-rows{flex:1;display:flex;flex-direction:column;gap:0;min-width:0;min-height:0}
.slide .v5-row{flex:1;display:flex;align-items:center;gap:calc(var(--s) * 24px);padding:calc(var(--s) * 12px) 0;border-bottom:1px solid var(--line);min-height:0}
.slide .v5-row:last-child{border-bottom:none}
.slide .v5-row-txt{display:flex;flex-direction:column;gap:6px;min-width:0}
.slide .v5-bignum{font-family:var(--font-heading);font-weight:800;color:var(--primary);line-height:1;flex:none}
.slide .v5-dark .v5-bignum{color:var(--accent)}
.slide .v5-bullets{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:calc(var(--s) * 14px)}
.slide .v5-bullets li{display:flex;gap:14px;align-items:flex-start;font-size:var(--fz-body);line-height:1.42;color:var(--ink)}
.slide .v5-bullets li::before{content:"";flex:none;width:10px;height:10px;margin-top:calc(var(--fz-body) * 0.5);border-radius:3px;background:var(--accent);transform:rotate(45deg)}
.slide .v5-checks li::before{display:none}
.slide .v5-mark{flex:none;display:flex;align-items:center;justify-content:center;width:calc(var(--s) * 34px);height:calc(var(--s) * 34px);border-radius:50%;margin-top:2px}
.slide .v5-mark i[data-icon]{width:60%;height:60%}
.slide .v5-mark-ok{background:color-mix(in srgb,#16a34a 16%,transparent);color:#15803d}
.slide .v5-mark-no{background:color-mix(in srgb,#dc2626 14%,transparent);color:#b91c1c}
.slide .v5-dark .v5-mark-ok{color:#4ade80}.slide .v5-dark .v5-mark-no{color:#f87171}
.slide .v5-mark-p{background:var(--soft);color:var(--primary)}
/* panels */
.slide .v5-panel{border-radius:var(--radius);padding:calc(var(--s) * 36px);display:flex;flex-direction:column;gap:calc(var(--s) * 16px);min-height:0;min-width:0;overflow:hidden}
.slide .v5-panel-primary{background:var(--strong);--on-primary:var(--on-strong);--ink:var(--on-strong);--muted:color-mix(in srgb,var(--on-strong) 82%,transparent);color:var(--on-strong)}
.slide .v5-panel-soft{background:var(--soft)}
.slide .v5-statement{font-family:var(--font-heading);font-weight:700;font-size:max(24px,calc(var(--s) * 34px));line-height:1.22;color:var(--ink);margin:0}
.slide .v5-chip{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--soft);color:var(--primary);font-weight:700;font-size:var(--fz-label);line-height:1.2}
.slide .v5-dark .v5-chip{color:var(--accent)}
/* stats */
.slide .v5-statval{font-family:var(--font-heading);font-weight:800;line-height:1;letter-spacing:-.02em;color:var(--primary);margin:0}
.slide .v5-dark .v5-statval{color:var(--accent)}
.slide .v5-statlabel{font-family:var(--font-heading);font-weight:700;font-size:var(--fz-h3);line-height:1.2;color:var(--ink);margin:0}
/* timeline */
.slide .v5-tl{flex:1;display:flex;flex-direction:column;min-width:0}
.slide .v5-tl-line{position:relative;height:28px;flex:none;margin:0 0 calc(var(--s) * 22px) 0}
.slide .v5-tl-line::before{content:"";position:absolute;left:0;right:14px;top:12px;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--primary),var(--accent))}
.slide .v5-tl-line::after{content:"";position:absolute;right:0;top:5px;border-left:16px solid var(--accent);border-top:9px solid transparent;border-bottom:9px solid transparent}
.slide .v5-tl-dot{position:absolute;top:2px;width:24px;height:24px;border-radius:50%;background:var(--bg);border:5px solid var(--primary)}
.slide .v5-tl-cols{flex:1;display:grid;gap:calc(var(--s) * 20px);min-height:0}
.slide .v5-tl-item{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0;padding:calc(var(--s) * 22px);overflow:hidden}
.slide .v5-tl-date{font-family:var(--font-heading);font-weight:800;font-size:max(22px,calc(var(--s) * 30px));line-height:1.05;color:var(--primary)}
.slide .v5-dark .v5-tl-date{color:var(--accent)}
/* process */
.slide .v5-proc{flex:1;display:flex;align-items:stretch;gap:0;min-width:0}
.slide .v5-proc > .v5-card{flex:1 1 0}
.slide .v5-arrow{flex:none;width:44px;display:flex;align-items:center;justify-content:center;color:var(--accent)}
.slide .v5-arrow svg{width:30px;height:30px}
.slide .v5-badge{display:flex;align-items:center;justify-content:center;flex:none;width:calc(var(--s) * 46px);height:calc(var(--s) * 46px);border-radius:50%;background:var(--primary);color:var(--on-primary);font-family:var(--font-heading);font-weight:800;font-size:max(18px,calc(var(--s) * 21px));line-height:1}
.slide .v5-dark .v5-badge{background:var(--accent);color:var(--on-accent)}
/* compare */
.slide .v5-vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;width:64px;height:64px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-weight:800;font-size:22px;box-shadow:0 0 0 8px var(--bg)}
.slide .v5-cmp-head{display:flex;align-items:center;gap:16px;padding-bottom:calc(var(--s) * 14px);border-bottom:2px solid var(--line)}
/* quote */
.slide .v5-quote{font-family:var(--font-heading);font-weight:600;font-size:calc(var(--ts) * 50px);line-height:1.22;color:var(--ink);margin:0;letter-spacing:-.01em}
.slide .v5-qmark{width:84px;height:64px;color:var(--accent);flex:none}
/* table */
.slide .v5-table{width:100%;height:100%;border-collapse:separate;border-spacing:0;font-size:var(--fz-body);line-height:1.3}
.slide .v5-table th{background:var(--primary);color:var(--on-primary);text-align:left;font-family:var(--font-heading);font-weight:700;padding:calc(var(--s) * 14px) calc(var(--s) * 20px)}
.slide .v5-table th:first-child{border-top-left-radius:var(--radius-sm)}.slide .v5-table th:last-child{border-top-right-radius:var(--radius-sm)}
.slide .v5-table td{padding:calc(var(--s) * 13px) calc(var(--s) * 20px);border-bottom:1px solid var(--line);color:var(--ink);vertical-align:top}
.slide .v5-table tr:nth-child(even) td{background:color-mix(in srgb,var(--primary) 5%,transparent)}
.slide .v5-table td:first-child{font-weight:700}
/* layers */
.slide .v5-layer{flex:1;display:flex;align-items:center;gap:calc(var(--s) * 28px);min-height:0}
.slide .v5-layer-shape{flex:none;display:flex;align-items:center;justify-content:center;height:100%;border-radius:var(--radius-sm);color:var(--on-primary);font-family:var(--font-heading);font-weight:700;font-size:var(--fz-h3);line-height:1.15;text-align:center;padding:4px 14px}
/* logo (title / closing slides) */
.slide .v5-logo{align-self:flex-start;background:#ffffff;border-radius:10px;padding:8px 12px;line-height:0;box-shadow:0 1px 4px rgba(0,0,0,.18)}
.slide .v5-logo img{display:block;max-width:190px;max-height:84px;width:auto;height:auto;object-fit:contain}
/* cycle */
.slide .v5-cyc{position:relative;min-height:0}
.slide .v5-cyc-ring{position:absolute;border-radius:50%;border:3px dashed color-mix(in srgb,var(--accent) 75%,transparent)}
.slide .v5-cyc-arrow{position:absolute;width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:18px solid var(--accent);z-index:1}
.slide .v5-cyc-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:170px;height:170px;border-radius:50%;background:var(--strong);color:var(--on-strong);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:18px;font-family:var(--font-heading);font-weight:800;font-size:20px;line-height:1.15;box-shadow:0 0 0 12px color-mix(in srgb,var(--primary) 14%,transparent)}
.slide .v5-cyc-node{position:absolute;transform:translate(-50%,-50%);gap:8px;padding:16px 16px;z-index:2;overflow:hidden;justify-content:center}
.slide .v5-cyc .v5-cyc-node{background:var(--surface);box-shadow:0 10px 26px -14px color-mix(in srgb,#000 50%,transparent)}
.slide .v5-cyc-ic{position:absolute;right:12px;top:12px;color:var(--primary);opacity:.85;display:flex}
.slide .v5-dark .v5-cyc-ic{color:var(--accent)}
/* hub */
.slide .v5-hub{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 290px minmax(0,1fr);min-width:0}
.slide .v5-hub-col{display:flex;flex-direction:column;justify-content:center;gap:calc(var(--s) * 18px);min-height:0;position:relative;padding:0}
.slide .v5-hub-card{flex:1 1 0;position:relative;overflow:visible}
.slide .v5-hub-col::after{content:"";position:absolute;top:calc((100% - (var(--n) - 1) * var(--s) * 18px) / var(--n) / 2);bottom:calc((100% - (var(--n) - 1) * var(--s) * 18px) / var(--n) / 2);border-left:2.5px dashed color-mix(in srgb,var(--accent) 80%,transparent)}
.slide .v5-steps .v5-row{padding:calc(var(--s) * 10px) 0;align-items:center}
.slide .v5-hub-one .v5-hub-card{flex:0 1 auto;min-height:200px;max-height:300px}
.slide .v5-hub-col-l::after{right:-48px}.slide .v5-hub-col-r::after{left:-48px}
.slide .v5-hub-l::after,.slide .v5-hub-r::before{content:"";position:absolute;top:50%;width:46px;border-top:2.5px dashed color-mix(in srgb,var(--accent) 80%,transparent)}
.slide .v5-hub-l::after{right:-48px}.slide .v5-hub-r::before{left:-48px}
.slide .v5-hub-mid{position:relative;display:flex;align-items:center;justify-content:center}
.slide .v5-hub-mid::before{content:"";position:absolute;left:46px;right:46px;top:50%;border-top:2.5px solid color-mix(in srgb,var(--accent) 80%,transparent)}
.slide .v5-hub-core{position:relative;z-index:1;width:196px;height:196px;border-radius:50%;background:var(--strong);color:var(--on-strong);display:flex;align-items:center;justify-content:center;text-align:center;padding:22px;font-family:var(--font-heading);font-weight:800;font-size:max(22px,calc(var(--s) * 26px));line-height:1.15;box-shadow:0 0 0 12px color-mix(in srgb,var(--primary) 16%,transparent),0 0 0 26px color-mix(in srgb,var(--primary) 7%,transparent)}
/* references */
.slide .v5-refs{list-style:none;margin:0;padding:0;columns:2;column-gap:56px}
.slide .v5-refs li{display:flex;gap:12px;break-inside:avoid;margin:0 0 calc(var(--s) * 14px) 0;font-size:max(18px,calc(var(--s) * 16px));line-height:1.38;color:var(--ink)}
.slide .v5-refs li b{color:var(--primary);flex:none}
.slide .v5-dark .v5-refs li b{color:var(--accent)}
.slide .v5-credits{margin-top:auto;padding-top:10px;border-top:1px solid var(--line);font-size:14px;line-height:1.35;color:var(--muted);columns:2;column-gap:56px}
.slide .v5-credits p{margin:0 0 3px 0;overflow-wrap:anywhere;break-inside:avoid}
.slide .v5-credits p:first-child{column-span:all;margin-bottom:6px}
/* hub: long words wrap inside their card (never past its edge) */
.slide .v5-hub-card h3,.slide .v5-hub-card p{overflow-wrap:anywhere;hyphens:auto;min-width:0}
/* closing: three things to remember */
.slide .v5-recap{display:flex;flex-direction:column;gap:12px;margin-top:4px}
.slide .v5-recap-row{display:flex;align-items:center;gap:16px}
.slide .v5-recap-n{flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-weight:800;font-size:20px;background:var(--hero-accent,var(--accent));color:var(--on-accent)}
.slide .v5-recap-t{font-size:min(24px,max(20px,calc(var(--s) * 22px)));line-height:1.28;color:var(--ink);font-weight:600}
/* engine v6 data layouts */
.slide .v5-trend-stat{flex:none;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:calc(var(--s) * 14px) calc(var(--s) * 24px);border-radius:var(--radius);background:var(--primary);color:var(--on-primary)}
.slide .v5-trend-stat b{font-family:var(--font-heading);font-weight:800;font-size:max(34px,calc(var(--s) * 44px));line-height:1}
.slide .v5-trend-stat span{font-size:20px;font-weight:600}
.slide .v5-trend-insight{flex:1;margin:0;align-self:center;font-family:var(--font-heading);font-weight:700;font-size:max(22px,calc(var(--s) * 27px));line-height:1.25;color:var(--ink);border-left:5px solid var(--accent);padding-left:calc(var(--s) * 20px)}
.slide .v6-flowchart svg{max-width:100%;max-height:100%;width:auto;height:auto}
.slide .v6-flowchart svg.v6-flow{width:100%;height:100%}
.slide .v6-chartbox svg{display:block;width:100%;height:100%}
`;
