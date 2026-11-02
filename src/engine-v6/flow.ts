/**
 * Engine v6 — flowchart slot → a static themed SVG (Mermaid, rendered on the server by v4's renderer).
 * The planner writes plain nodes and edges; code writes the Mermaid text, so a model never writes diagram code.
 */
import { renderMermaid } from "../engine-v4/mermaid";
import type { DesignSystem } from "../engine-v3/types";
import type { SlideContent } from "../engine-v5/templates";

const clean = (s: string) => String(s || "").replace(/["|<>{}\[\]#;`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

export function flowToMermaid(flow: NonNullable<SlideContent["flow"]>): string {
  const nodes = flow.nodes.slice(0, 8);
  const id = (raw: string) => "n" + raw.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  // wide slides read left → right; a long chain with branches reads top → down only when it has 7+ boxes
  const dir = nodes.length >= 7 ? "TD" : "LR";
  const lines = [`flowchart ${dir}`];
  for (const n of nodes) {
    const t = clean(n.label);
    lines.push(n.type === "decision" ? `  ${id(n.id)}{"${t}"}` : n.type === "end" || n.type === "start" ? `  ${id(n.id)}(["${t}"])` : `  ${id(n.id)}["${t}"]`);
  }
  for (const e of flow.edges.slice(0, 12)) {
    const l = clean(e.label || "").slice(0, 16);
    lines.push(l ? `  ${id(e.from)} -->|${l}| ${id(e.to)}` : `  ${id(e.from)} --> ${id(e.to)}`);
  }
  return lines.join("\n");
}

/** draws the slide's flowchart (once) — the template falls back to a simple flow diagram without it */
export async function prepareFlowchart(c: SlideContent, design: Pick<DesignSystem, "palette" | "font">): Promise<SlideContent> {
  if (c.template !== "flowchart" || !c.flow || c.flow.nodes.length < 2) return c;
  const own = flowSvg(c.flow, 1120, c.takeaway ? 400 : 460);
  if (own) return { ...c, svg: own };
  try {
    const r = await renderMermaid(flowToMermaid(c.flow), { width: 1100, height: c.takeaway ? 380 : 440, design });
    if (r.svg) return { ...c, svg: r.svg };
    console.log(`[v6] flowchart could not be drawn: ${r.error || "unknown"}`);
  } catch (e: any) {
    console.log(`[v6] flowchart renderer unavailable: ${String(e?.message || e).slice(0, 120)}`);
  }
  return c;
}

// ── own layered flowchart (big readable boxes; Mermaid's auto-layout shrank 6 boxes to ~12px text) ──
function wrapText(t: string, maxChars: number, maxLines = 3): string[] {
  const words = String(t).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1] + "…"; return k; }
  return lines;
}

export function flowSvg(flow: NonNullable<SlideContent["flow"]>, W = 1120, Hmax = 440): string {
  const nodes = flow.nodes.slice(0, 8);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = flow.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to).slice(0, 12);
  if (nodes.length < 2) return "";
  // level = longest path from a root (cycles broken by visit order)
  const lvl: Record<string, number> = {};
  nodes.forEach((n) => (lvl[n.id] = 0));
  for (let k = 0; k < nodes.length; k++) for (const e of edges) {
    const fi = nodes.findIndex((n) => n.id === e.from), ti = nodes.findIndex((n) => n.id === e.to);
    if (ti > fi || lvl[e.to] <= lvl[e.from]) { if (ti > fi && lvl[e.to] < lvl[e.from] + 1) lvl[e.to] = lvl[e.from] + 1; }
  }
  const L = Math.max(...Object.values(lvl)) + 1;
  const cols: string[][] = Array.from({ length: L }, () => []);
  nodes.forEach((n) => cols[lvl[n.id]].push(n.id));
  const maxRows = Math.max(...cols.map((c) => c.length));
  // arrows get room for their words ("yes", "raises") when the boxes can spare it
  const maxLab = Math.max(0, ...edges.map((e) => String(e.label || "").length * (/[\u0900-\u097F]/.test(String(e.label)) ? 11 : 9.5)));
  const gapX = Math.min(L > 5 ? 70 : 104, Math.max(L > 5 ? 36 : 46, maxLab + 14)), gapY = 30;
  const bw = Math.min(260, (W - 12 - gapX * (L - 1)) / L);
  const FS = bw < 170 ? 20 : maxRows === 1 && bw >= 200 ? 26 : 22;
  // the drawing is as tall as its rows need, so it fills the slide's width instead of shrinking into a tall box
  const bh = Math.min(maxRows > 2 ? (Hmax - 24 - gapY * (maxRows - 1)) / maxRows : maxRows > 1 ? 112 : 190, 190);
  const H = Math.round(maxRows * bh + (maxRows - 1) * gapY + 24);
  const totalW = bw * L + gapX * (L - 1), x0 = (W - totalW) / 2;
  const pos: Record<string, { x: number; y: number }> = {};
  cols.forEach((c, li) => {
    const colH = c.length * bh + (c.length - 1) * gapY, y0 = (H - colH) / 2;
    c.forEach((id, ri) => (pos[id] = { x: x0 + li * (bw + gapX), y: y0 + ri * (bh + gapY) }));
  });
  const out: string[] = [`<svg class="v6-flow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" font-family="var(--font-body)">`,
    `<defs><marker id="v6arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker></defs>`];
  for (const e of edges) {
    const a = pos[e.from], b = pos[e.to];
    let d: string, lx: number, ly: number;
    if (Math.abs(b.x - a.x) < 1) { // same column: down/up
      const x = a.x + bw / 2, y1 = b.y > a.y ? a.y + bh : a.y, y2 = b.y > a.y ? b.y - 4 : b.y + bh + 4;
      d = `M${x},${y1} L${x},${y2}`; lx = x + 10; ly = (y1 + y2) / 2;
    } else {
      const fw = b.x > a.x;
      const x1 = fw ? a.x + bw : a.x, y1 = a.y + bh / 2, x2 = fw ? b.x - 4 : b.x + bw + 4, y2 = b.y + bh / 2, mx = (x1 + x2) / 2;
      d = Math.abs(y1 - y2) < 1 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
      lx = mx; ly = Math.abs(y1 - y2) < 1 ? y1 - 12 : (y1 + y2) / 2;
    }
    out.push(`<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linejoin="round" marker-end="url(#v6arr)"/>`);
    // an edge label is printed only where it fits beside its arrow (never over a box)
    const lw = String(e.label || "").length * (/[\u0900-\u097F]/.test(String(e.label)) ? 11 : 9.5);
    const room = Math.abs(b.x - a.x) < 1 ? 999 : Math.abs(a.y - b.y) < 1 ? gapX - 8 : 999;
    if (e.label && lw <= room) out.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--accent-ink, var(--ink))" paint-order="stroke" stroke="var(--surface,#fff)" stroke-width="6">${esc(String(e.label).slice(0, 14))}</text>`);
  }
  nodes.forEach((n, i) => {
    const p = pos[n.id];
    const dec = n.type === "decision", end = n.type === "end" || n.type === "start";
    const r = end ? bh / 2 : 14;
    const fill = dec ? "var(--surface,#fff)" : i === 0 || end ? "var(--primary)" : "var(--surface,#fff)";
    const ink = (i === 0 || end) && !dec ? "var(--on-primary,#fff)" : "var(--ink)";
    out.push(`<rect x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(r, 40)}" fill="${fill}" stroke="${dec ? "var(--accent)" : "var(--primary)"}" stroke-width="${dec ? 3.5 : 2.5}"${dec ? ` stroke-dasharray="10 6"` : ""}/>`);
    const maxL = Math.max(2, Math.floor((bh - 14) / (18 * 1.2)));
    const label = n.label + (dec && !/\?$/.test(n.label) ? "?" : "");
    // the biggest size (22 → 18px) at which the whole label fits in the box without cutting a word
    const gw = /[\u0900-\u097F]/.test(label) ? 0.62 : 0.52; // Devanagari runs wider
    let fs2 = FS, lines = wrapText(label, Math.floor((bw - 22) / (fs2 * gw)), 99);
    while ((lines.length > Math.floor((bh - 14) / (fs2 * 1.2)) || lines.some((l) => l.endsWith("…"))) && fs2 > 18) { fs2 -= 1; lines = wrapText(label, Math.floor((bw - 22) / (fs2 * gw)), 99); }
    if (lines.length > maxL) lines = wrapText(label, Math.floor((bw - 22) / (fs2 * gw)), maxL);
    const lh = fs2 * 1.2, ty = p.y + bh / 2 - (lh * (lines.length - 1)) / 2 + fs2 * 0.35;
    lines.forEach((ln, k) => out.push(`<text x="${(p.x + bw / 2).toFixed(1)}" y="${(ty + k * lh).toFixed(1)}" text-anchor="middle" font-size="${fs2}" font-weight="700" fill="${ink}">${esc(ln)}</text>`));
  });
  out.push(`</svg>`);
  return out.join("");
}
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
