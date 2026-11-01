/**
 * Engine v4 — make_diagram: a JSON spec → markup the designer pastes into its slide.
 *  - engine kinds (flow, cycle, hub, layers, timeline, compare, bars, tree, matrix, sequence, line, donut, stacked):
 *    the v3 diagram component (<figure class="v3-diagram">) draws on-brand nodes/arrows that fill the box, labels stay
 *    editable HTML (PPTX); an item's icon is drawn inside its node (the engine places it — models forget to);
 *  - mermaid: branching flowcharts / state / sequence diagrams rendered server-side to a static, themed SVG.
 */
import { resolveIconName } from "./iconRender";
import { renderMermaid } from "./mermaid";
import type { DesignSystem } from "../engine-v3/types";

export interface DiagramItem {
  title?: string;
  desc?: string;
  value?: number | string;
  unit?: string;
  values?: (number | string)[];
  parent?: string;
  from?: string;
  to?: string;
  icon?: string;
  highlight?: boolean;
}

export interface DiagramSpec {
  kind: string;
  items?: (DiagramItem | string)[];
  box?: { left?: number; top?: number; width?: number; height?: number };
  /** chart kinds: kind "chart" + chart line|donut|stacked|bars */
  chart?: string;
  series?: string[];
  axes?: { x?: string; y?: string };
  actors?: string[];
  code?: string;
  size?: number;
  direction?: string;
}

export const ENGINE_KINDS = ["flow", "cycle", "hub", "layers", "timeline", "compare", "bars", "tree", "matrix", "sequence", "line", "donut", "stacked"];
export const ALL_KINDS = [...ENGINE_KINDS, "chart", "mermaid"];

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};

function normKind(spec: DiagramSpec): string {
  let k = String(spec.kind || "flow").toLowerCase().trim();
  const alias: Record<string, string> = { process: "flow", steps: "flow", flowchart: "mermaid", radial: "hub", "hub-and-spoke": "hub", spoke: "hub", stack: "layers", architecture: "layers", bar: "bars", hierarchy: "tree", org: "tree", quadrant: "matrix", "2x2": "matrix", pie: "donut", state: "mermaid" };
  k = alias[k] || k;
  if (k === "chart") k = ({ line: "line", donut: "donut", pie: "donut", stacked: "stacked", bar: "bars", bars: "bars" } as Record<string, string>)[String(spec.chart || "bars").toLowerCase()] || "bars";
  if (k === "sequence" && spec.code) k = "mermaid";
  return ALL_KINDS.includes(k) ? k : "flow";
}

export interface DiagramResult {
  markup: string;
  kind: string;
  warnings: string[];
  icons: string[];
}

export async function makeDiagram(spec: DiagramSpec, design?: Pick<DesignSystem, "palette" | "font">): Promise<DiagramResult> {
  const kind = normKind(spec);
  const b = spec.box || {};
  const left = num(b.left, 620, -40, 1240), top = num(b.top, 170, -40, 680);
  const width = num(b.width, 580, 120, 1280), height = num(b.height, 400, 100, 720);
  const warnings: string[] = [];
  if (left + width > 1280 || top + height > 720) warnings.push(`the box ends at ${left + width}×${top + height}, past the 1280×720 canvas — shrink it`);
  if (width < 440 || height < 280) warnings.push("the box is small; labels may shrink — at least 480×300 is better");
  const box = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px`;

  if (kind === "mermaid") {
    if (!spec.code) return { markup: "", kind, warnings: ["mermaid needs spec.code (e.g. 'flowchart LR\\n A[Start] --> B{OK?}')"], icons: [] };
    const r = await renderMermaid(String(spec.code), { width, height, design });
    if (!r.svg) return { markup: "", kind, warnings: [`mermaid could not draw this: ${r.error || "unknown error"} — fix the code or use kind flow/tree/sequence`], icons: [] };
    return { markup: `<figure class="v4-mermaid" style="${box};margin:0;display:flex;align-items:center;justify-content:center">${r.svg}</figure>`, kind, warnings, icons: [] };
  }

  const items: DiagramItem[] = (spec.items || []).map((x) => (typeof x === "string" ? { title: x } : x || {})).filter((x) => x.title || x.desc || x.value != null);
  if (!items.length) return { markup: "", kind, warnings: ["items is empty — give 3–6 items like {\"title\":\"Step\",\"desc\":\"short\"}"], icons: [] };
  const maxItems: Record<string, number> = { tree: 12, sequence: 10, line: 12, bars: 8, stacked: 8, donut: 6, matrix: 4, compare: 8 };
  const cap = maxItems[kind] ?? 7;
  if (items.length > cap) warnings.push(`${items.length} items is too many for ${kind}; kept the first ${cap}`);
  const icons: string[] = [];
  const lis = items.slice(0, cap).map((it) => {
    const a: string[] = [];
    if (it.value != null && it.value !== "") a.push(`data-value="${esc(parseFloat(String(it.value)))}"`);
    if (it.unit) a.push(`data-unit="${esc(it.unit)}"`);
    if (Array.isArray(it.values) && it.values.length) a.push(`data-values="${esc(it.values.map((v) => parseFloat(String(v))).filter((v) => Number.isFinite(v)).join(","))}"`);
    if (it.parent) a.push(`data-parent="${esc(it.parent)}"`);
    if (it.from) a.push(`data-from="${esc(it.from)}"`);
    if (it.to) a.push(`data-to="${esc(it.to)}"`);
    if (it.highlight) a.push(`data-highlight`);
    let ic = "";
    if (it.icon) {
      const id = resolveIconName(String(it.icon));
      if (id) {
        icons.push(id);
        ic = `<i class="ic" data-icon="${esc(id)}"></i>`;
      } else warnings.push(`no icon found for "${it.icon}"`);
    }
    const title = it.title ? `<strong>${esc(it.title)}</strong>` : "";
    const desc = it.desc ? ` ${esc(it.desc)}` : "";
    return `  <li${a.length ? " " + a.join(" ") : ""}>${ic}${title}${desc}</li>`;
  });
  if ((kind === "bars" || kind === "line" || kind === "donut") && !items.some((x) => x.value != null && Number.isFinite(parseFloat(String(x.value))))) warnings.push(`${kind} needs a numeric value per item (only real numbers from the brief)`);
  if (kind === "matrix" && items.length !== 4) warnings.push("a matrix has exactly 4 quadrants (top-left, top-right, bottom-left, bottom-right)");
  const fa: string[] = [`class="v3-diagram"`, `data-kind="${kind}"`];
  if (spec.size) fa.push(`data-size="${num(spec.size, 22, 15, 34)}"`);
  if (kind === "matrix" && spec.axes?.x) fa.push(`data-x="${esc(spec.axes.x)}"`);
  if (kind === "matrix" && spec.axes?.y) fa.push(`data-y="${esc(spec.axes.y)}"`);
  if (kind === "sequence") fa.push(`data-actors="${esc((spec.actors || []).join("|"))}"`);
  if (kind === "stacked" && spec.series?.length) fa.push(`data-series="${esc(spec.series.join("|"))}"`);
  const markup = `<figure ${fa.join(" ")} style="${box}">\n${lis.join("\n")}\n</figure>`;
  return { markup, kind, warnings, icons };
}
