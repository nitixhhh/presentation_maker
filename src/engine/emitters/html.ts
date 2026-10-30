/**
 * Engine v2 — HTML Emitter
 * Converts SceneGraph → self-contained HTML slideshow.
 * CSS-transformed 1280×720 stage, keyboard nav, speaker notes toggle.
 */

import type { SceneGraph, SceneGraphSlide, Shape, Fill, TextStyle, GradientFill } from "../sceneGraph";
import { CANVAS, CANVAS_PX, inToPx } from "../canvas";

function fillToCSS(fill: Fill): string {
  if (fill.kind === "solid") {
    const op = fill.opacity !== undefined ? fill.opacity : 1;
    if (op < 1) {
      const r = parseInt(fill.color.slice(1, 3), 16);
      const g = parseInt(fill.color.slice(3, 5), 16);
      const b = parseInt(fill.color.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${op})`;
    }
    return fill.color;
  }
  if (fill.kind === "gradient") {
    const stops = fill.stops.map((s) => `${s.color} ${Math.round(s.pos * 100)}%`).join(", ");
    if (fill.type === "radial") return `radial-gradient(circle, ${stops})`;
    return `linear-gradient(${fill.angle ?? 135}deg, ${stops})`;
  }
  return "transparent";
}

function textStyleToCSS(s: TextStyle): string {
  const parts: string[] = [];
  parts.push(`font-family: '${s.fontFamily}', sans-serif`);
  parts.push(`font-size: ${s.fontSize}pt`);
  parts.push(`color: ${s.color}`);
  if (s.bold) parts.push("font-weight: 700");
  if (s.italic) parts.push("font-style: italic");
  if (s.lineHeight) parts.push(`line-height: ${s.lineHeight}`);
  else parts.push("line-height: 1.35");
  if (s.align) parts.push(`text-align: ${s.align}`);
  if (s.charSpacing) parts.push(`letter-spacing: ${s.charSpacing}px`);
  if (s.textTransform) parts.push(`text-transform: ${s.textTransform}`);
  return parts.join("; ");
}

function rectToCSS(rect: { x: number; y: number; w: number; h: number }): string {
  return `left:${inToPx(rect.x)}px; top:${inToPx(rect.y)}px; width:${inToPx(rect.w)}px; height:${inToPx(rect.h)}px;`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderShape(shape: Shape): string {
  const base = `position:absolute; ${rectToCSS(shape.rect)}`;
  const z = shape.zIndex !== undefined ? `z-index:${shape.zIndex};` : "";
  const op = shape.opacity !== undefined ? `opacity:${shape.opacity};` : "";

  switch (shape.type) {
    case "rect": {
      const bg = `background: ${fillToCSS(shape.fill)};`;
      const br = shape.cornerRadius ? `border-radius: ${shape.cornerRadius}px;` : "";
      const stroke = shape.stroke ? `border: ${shape.stroke.width}px solid ${shape.stroke.color};` : "";
      const shadow = shape.shadow ? `box-shadow: ${shape.shadow.offsetX}px ${shape.shadow.offsetY}px ${shape.shadow.blur}px ${shape.shadow.color};` : "";
      return `<div style="${base} ${bg} ${br} ${stroke} ${shadow} ${z} ${op}"></div>`;
    }

    case "text": {
      const textCSS = textStyleToCSS(shape.style);
      const valign = shape.style.valign === "middle" ? "display:flex; align-items:center; justify-content:center;" : shape.style.valign === "bottom" ? "display:flex; align-items:flex-end;" : "";
      const content = shape.runs.map((r) => {
        let html = escapeHtml(r.text);
        if (r.bold) html = `<strong>${html}</strong>`;
        if (r.italic) html = `<em>${html}</em>`;
        return html;
      }).join("");
      return `<div style="${base} ${textCSS}; ${valign} ${z} ${op} overflow:hidden; word-break:break-word;">${content}</div>`;
    }

    case "bulletList": {
      const textCSS = textStyleToCSS(shape.style);
      const tag = shape.bulletStyle === "number" ? "ol" : "ul";
      const listStyle = shape.bulletStyle === "disc" ? `list-style-type:disc; color:${shape.bulletColor};` : shape.bulletStyle === "dash" ? "list-style-type:'— ';" : shape.bulletStyle === "none" ? "list-style:none;" : "";
      const items = shape.items.map((it) => `<li style="margin-bottom:${(shape.itemSpacing || 0.2) * 30}px; color:${shape.style.color}"><span style="color:${shape.style.color}">${escapeHtml(it)}</span></li>`).join("");
      return `<div style="${base} ${z} ${op} overflow:hidden;"><${tag} style="${textCSS}; ${listStyle} padding-left:20px; margin:0;">${items}</${tag}></div>`;
    }

    case "image": {
      const br = shape.cornerRadius ? `border-radius: ${shape.cornerRadius}px;` : "";
      const overlay = shape.overlay ? `<div style="position:absolute;inset:0;background:${fillToCSS(shape.overlay)};${br}"></div>` : "";
      const credit = shape.credit ? `<div style="position:absolute;bottom:4px;right:8px;font-size:8pt;color:rgba(255,255,255,0.6);">${escapeHtml(shape.credit)}</div>` : "";
      const imgSrc = shape.src.startsWith("fixture://") ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect fill='%23334155' width='800' height='600'/><text x='400' y='300' text-anchor='middle' fill='%2394A3B8' font-size='20'>${shape.alt}</text></svg>`)}` : shape.src;
      return `<div style="${base} ${z} ${op} overflow:hidden; ${br}"><img src="${imgSrc}" alt="${escapeHtml(shape.alt)}" style="width:100%;height:100%;object-fit:${shape.objectFit};${br}" />${overlay}${credit}</div>`;
    }

    case "icon": {
      return `<div style="${base} ${z} ${op} display:flex;align-items:center;justify-content:center;"><svg width="${shape.size}" height="${shape.size}" viewBox="0 0 24 24" fill="none" stroke="${shape.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><text x="12" y="16" text-anchor="middle" font-size="8" fill="${shape.color}" stroke="none">${shape.iconName.slice(0, 3)}</text></svg></div>`;
    }

    case "bigNumber": {
      const numCSS = textStyleToCSS(shape.numberStyle);
      const lblCSS = textStyleToCSS(shape.labelStyle);
      const sup = shape.supporting ? `<div style="font-size:11pt;color:${shape.labelStyle.color};opacity:0.7;margin-top:4px;">${escapeHtml(shape.supporting)}</div>` : "";
      return `<div style="${base} ${z} ${op} display:flex;flex-direction:column;align-items:center;justify-content:center;"><div style="${numCSS}">${escapeHtml(shape.number)}</div><div style="${lblCSS};margin-top:8px;">${escapeHtml(shape.label)}</div>${sup}</div>`;
    }

    case "chart": {
      const src = shape.chartPng.startsWith("data:") ? shape.chartPng : `data:image/png;base64,${shape.chartPng}`;
      return `<div style="${base} ${z} ${op}"><img src="${src}" alt="${shape.title || 'Chart'}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
    }

    case "diagram": {
      if (shape.renderedPng) {
        const src = shape.renderedPng.startsWith("data:") ? shape.renderedPng : `data:image/png;base64,${shape.renderedPng}`;
        return `<div style="${base} ${z} ${op}"><img src="${src}" alt="Diagram" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      }
      return `<div style="${base} ${z} ${op} display:flex;align-items:center;justify-content:center;border:1px dashed #666;border-radius:8px;color:#999;font-size:12pt;">[${shape.diagramKind} diagram]</div>`;
    }

    default:
      return "";
  }
}

function renderSlide(slide: SceneGraphSlide, ds: SceneGraph["designSystem"]): string {
  const bg = fillToCSS(slide.background);
  const shapesHtml = slide.shapes
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map(renderShape)
    .join("\n    ");

  return `
  <section class="slide" id="slide-${slide.index}" data-notes="${escapeHtml(slide.speakerNotes)}" style="background:${bg};">
    ${shapesHtml}
    <div class="slide-counter">${slide.index + 1}</div>
  </section>`;
}

/** Convert a complete SceneGraph to a self-contained HTML slideshow string. */
export function emitHtml(sg: SceneGraph): string {
  const slides = sg.slides.map((s) => renderSlide(s, sg.designSystem)).join("\n");
  const fontUrl = sg.designSystem.fonts.googleFontUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(sg.topic)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="${fontUrl}" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;overflow:hidden;font-family:'${sg.designSystem.fonts.body}',sans-serif}
.stage{width:${CANVAS_PX.W}px;height:${CANVAS_PX.H}px;position:relative;margin:auto;overflow:hidden}
.slide{width:${CANVAS_PX.W}px;height:${CANVAS_PX.H}px;position:absolute;top:0;left:0;display:none;overflow:hidden}
.slide.active{display:block}
.slide-counter{position:absolute;bottom:8px;right:14px;font-size:9pt;color:rgba(255,255,255,0.35);font-family:monospace}
#notes-panel{position:fixed;bottom:0;left:0;right:0;max-height:180px;background:rgba(0,0,0,0.92);color:#ccc;padding:16px 24px;font-size:11pt;line-height:1.5;display:none;overflow-y:auto;z-index:1000;border-top:2px solid #333}
#notes-panel.visible{display:block}
#nav-hint{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.25);font-size:9pt;font-family:monospace;z-index:999}
</style>
</head>
<body>
<div class="stage" id="stage">
${slides}
</div>
<div id="notes-panel"></div>
<div id="nav-hint">← → navigate · N notes · F fullscreen</div>
<script>
(function(){
  const slides=document.querySelectorAll('.slide');
  const notesPanel=document.getElementById('notes-panel');
  let cur=0,notesOn=false;
  function show(i){
    slides.forEach((s,idx)=>{s.classList.toggle('active',idx===i)});
    cur=i;
    if(notesOn)notesPanel.textContent=slides[i].dataset.notes||'No notes';
    // Scale stage to fit viewport
    const stage=document.getElementById('stage');
    const sx=window.innerWidth/${CANVAS_PX.W},sy=window.innerHeight/${CANVAS_PX.H};
    const s=Math.min(sx,sy);
    stage.style.transform='scale('+s+')';
    stage.style.transformOrigin='top left';
    stage.style.marginLeft=((window.innerWidth-${CANVAS_PX.W}*s)/2)+'px';
    stage.style.marginTop=((window.innerHeight-${CANVAS_PX.H}*s)/2)+'px';
  }
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' ')show(Math.min(cur+1,slides.length-1));
    else if(e.key==='ArrowLeft')show(Math.max(cur-1,0));
    else if(e.key==='n'||e.key==='N'){notesOn=!notesOn;notesPanel.classList.toggle('visible',notesOn);if(notesOn)notesPanel.textContent=slides[cur].dataset.notes||'No notes';}
    else if(e.key==='f'||e.key==='F'){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();}
  });
  window.addEventListener('resize',()=>show(cur));
  window.addEventListener('message',function(e){
    if(e.data && e.data.type==='GOTO_SLIDE' && typeof e.data.index==='number'){
      show(Math.max(0, Math.min(e.data.index, slides.length-1)));
    }
  });
  show(0);
})();
</script>
</body>
</html>`;
}

