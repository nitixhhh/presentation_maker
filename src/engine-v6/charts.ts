/**
 * Engine v6 — data charts drawn on the server as one inline SVG in the deck's palette (CSS variables), so the
 * preview, the PDF (vector) and the PPTX (the slide background image) show exactly the same chart. Every label sits
 * on the point it names; values are printed on the chart; the axis says where it starts.
 */
import type { SlideContent } from "../engine-v5/templates";

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 1, 2, 2.5, 5 × 10^k steps that give 3–5 grid lines */
export function niceScale(lo: number, hi: number, ticks = 4): { min: number; max: number; step: number } {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

const fmt = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 100 ? v.toFixed(0) : a >= 10 ? (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)) : Number.isInteger(v) ? v.toFixed(0) : v.toFixed(a < 1 ? 2 : 1);
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
};

export interface ChartSpec { kind: "line" | "bars"; unit?: string; items: { label: string; value: number }[] }

/** the chart as SVG markup (viewBox w × h; text is ≥ 20px at that size) */
export function chartSvg(spec: ChartSpec, w = 660, h = 400): string {
  const items = spec.items.filter((i) => Number.isFinite(i.value)).slice(0, 10);
  const n = items.length;
  if (n < 2) return "";
  const unit = String(spec.unit || "").slice(0, 6);
  const pre = /^[$€£₹¥]/.test(unit) ? unit : "";
  // "%" and "x" sit on the number; a word unit ("bn", "rel. rate") gets a space
  const post = pre ? "" : unit && !/^(%|x|×|°|°C|pp)$/i.test(unit) ? " " + unit : unit;
  const vals = items.map((i) => i.value);
  const vmax = Math.max(...vals), vmin = Math.min(...vals);
  // bars always start at zero; a line starts at zero unless the change would be a flat line near the top
  const fromZero = spec.kind === "bars" || vmin <= 0 || (vmax - vmin) / Math.max(Math.abs(vmax), 1e-9) > 0.45;
  const sc = niceScale(fromZero ? Math.min(0, vmin) : vmin - (vmax - vmin) * 0.25, vmax + (vmax - vmin || Math.abs(vmax) || 1) * 0.12);
  const FS = 23, padL = 74, padR = 28, padT = 46, padB = 52;
  const pw = w - padL - padR, ph = h - padT - padB;
  const LF = n > 7 ? 18 : FS - 2, LC = Math.max(6, Math.floor(pw / n / (LF * 0.56)));
  const y = (v: number) => padT + ph - (ph * (v - sc.min)) / (sc.max - sc.min);
  const out: string[] = [];
  out.push(`<svg class="v6-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" font-family="var(--font-body)">`);
  out.push(`<defs><linearGradient id="v6area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".26"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>`);
  // grid + y ticks
  for (let v = sc.min; v <= sc.max + sc.step / 2; v += sc.step) {
    const yy = y(v).toFixed(1);
    out.push(`<line x1="${padL}" x2="${w - padR}" y1="${yy}" y2="${yy}" stroke="var(--ink)" stroke-opacity="${v === sc.min ? 0.35 : 0.1}" stroke-width="${v === sc.min ? 2 : 1.5}"${v === sc.min ? "" : ` stroke-dasharray="4 6"`}/>`);
    out.push(`<text x="${padL - 14}" y="${(+yy + 7).toFixed(1)}" text-anchor="end" font-size="${FS - 2}" fill="var(--muted)">${esc(pre + fmt(v) + post)}</text>`);
  }
  const imax = vals.indexOf(vmax), last = n - 1;
  if (spec.kind === "bars") {
    const slot = pw / n, bw = Math.min(110, slot * 0.62);
    items.forEach((it, i) => {
      const cx = padL + slot * (i + 0.5), top = y(Math.max(it.value, sc.min)), base = y(Math.max(0, sc.min));
      const hi = i === imax;
      out.push(`<rect x="${(cx - bw / 2).toFixed(1)}" y="${Math.min(top, base).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(3, Math.abs(base - top)).toFixed(1)}" rx="8" fill="${hi ? "var(--accent)" : "var(--primary)"}" fill-opacity="${hi ? 1 : 0.85}"/>`);
      out.push(`<text x="${cx.toFixed(1)}" y="${(Math.min(top, base) - 12).toFixed(1)}" text-anchor="middle" font-size="${FS}" font-weight="800" fill="var(--ink)">${esc(pre + fmt(it.value) + post)}</text>`);
      out.push(`<text x="${cx.toFixed(1)}" y="${(padT + ph + 34).toFixed(1)}" text-anchor="middle" font-size="${LF}" font-weight="600" fill="var(--muted)">${esc(String(it.label).slice(0, LC))}</text>`);
    });
  } else {
    const x = (i: number) => padL + 30 + ((pw - 60) * i) / (n - 1);
    const pts = items.map((it, i) => [x(i), y(it.value)] as [number, number]);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    out.push(`<path d="${d} L${pts[last][0].toFixed(1)},${y(sc.min).toFixed(1)} L${pts[0][0].toFixed(1)},${y(sc.min).toFixed(1)} Z" fill="url(#v6area)"/>`);
    out.push(`<path d="${d}" fill="none" stroke="var(--primary)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`);
    const showAll = n <= 8;
    pts.forEach((p, i) => {
      const key = i === imax || i === last || i === 0;
      out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${key ? 10 : 7}" fill="${key ? "var(--accent)" : "var(--surface, #fff)"}" stroke="${key ? "var(--surface, #fff)" : "var(--primary)"}" stroke-width="${key ? 4 : 4}"/>`);
      if (showAll || key) out.push(`<text x="${p[0].toFixed(1)}" y="${(p[1] - 20).toFixed(1)}" text-anchor="middle" font-size="${key ? FS + 2 : FS - 1}" font-weight="800" fill="var(--ink)">${esc(pre + fmt(items[i].value) + post)}</text>`);
      out.push(`<text x="${p[0].toFixed(1)}" y="${(padT + ph + 34).toFixed(1)}" text-anchor="middle" font-size="${LF}" font-weight="600" fill="var(--muted)">${esc(String(items[i].label).slice(0, LC))}</text>`);
    });
  }
  out.push(`</svg>`);
  return out.join("");
}

/** shares of a whole: a ring with the biggest part in the primary colour and a legend that reads value-first */
export function donutSvg(spec: { unit?: string; items: { label: string; value: number }[] }, w = 660, h = 420): string {
  const items = spec.items.filter((i) => Number.isFinite(i.value) && i.value > 0).slice(0, 6);
  if (items.length < 2) return "";
  const unit = String(spec.unit || "").slice(0, 6);
  const pre = /^[$€£₹¥]/.test(unit) ? unit : "", post = pre ? "" : unit;
  const tot = items.reduce((a, b) => a + b.value, 0);
  const cols = ["var(--primary)", "var(--accent)", "var(--accent2)", "color-mix(in srgb,var(--primary) 50%,var(--surface,#fff))", "color-mix(in srgb,var(--accent) 50%,var(--surface,#fff))", "var(--muted)"];
  const R = Math.min(h / 2 - 16, 180), sw = R * 0.36, cx = R + 14, cy = h / 2, r = R - sw / 2, C = 2 * Math.PI * r;
  const out: string[] = [`<svg class="v6-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" font-family="var(--font-body)">`];
  let off = 0;
  items.forEach((it, i) => {
    const len = (C * it.value) / tot;
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${cols[i]}" stroke-width="${sw.toFixed(1)}" stroke-dasharray="${Math.max(0, len - 4).toFixed(1)} ${(C - Math.max(0, len - 4)).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`);
    off += len;
  });
  const big = items[0];
  out.push(`<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="var(--font-heading)" font-size="54" font-weight="800" fill="var(--ink)">${esc(pre + fmt(big.value) + post)}</text>`);
  out.push(`<text x="${cx}" y="${cy + 40}" text-anchor="middle" font-size="20" font-weight="600" fill="var(--muted)">${esc(big.label.slice(0, 18))}</text>`);
  const lx = cx + R + 40, rowH = Math.min(78, (h - 20) / items.length), ly0 = cy - (rowH * items.length) / 2;
  const chars = Math.floor((w - lx - 40) / 12);
  items.forEach((it, i) => {
    const yy = ly0 + rowH * i + rowH / 2;
    out.push(`<rect x="${lx}" y="${(yy - 14).toFixed(1)}" width="22" height="22" rx="6" fill="${cols[i]}"/>`);
    out.push(`<text x="${lx + 36}" y="${(yy + 4).toFixed(1)}" font-size="28" font-weight="800" fill="var(--ink)">${esc(pre + fmt(it.value) + post)}</text>`);
    out.push(`<text x="${lx + 36}" y="${(yy + 30).toFixed(1)}" font-size="22" font-weight="500" fill="var(--muted)">${esc(it.label.slice(0, chars))}</text>`);
  });
  out.push(`</svg>`);
  return out.join("");
}

/** draws a chart-trend slide's chart once (the template falls back to the shared diagram without it) */
export function prepareChart(c: SlideContent): SlideContent {
  if ((c.template !== "chart-trend" && c.template !== "donut") || !c.chart?.items?.length) return c;
  const items = c.chart.items.map((i) => ({ label: String(i.label || ""), value: typeof i.value === "number" ? i.value : parseFloat(String(i.value).replace(/[^0-9.\-]/g, "")) })).filter((i) => Number.isFinite(i.value));
  const svg = c.template === "donut" ? donutSvg({ unit: c.chart.unit, items }) : chartSvg({ kind: c.chart.kind === "bars" ? "bars" : "line", unit: c.chart.unit, items });
  return svg ? { ...c, svg } : c;
}

/** the deck's headline number for a title slide without a photo: the first big-stat, else the first stat in a row */
export function heroStatOf(slides: { template: string; stat?: { value?: string; label?: string; text?: string }; items?: { value?: string; label?: string; title?: string }[] }[]): { value: string; label: string } | undefined {
  const num = (v?: string) => !!v && /\d/.test(v) && String(v).length <= 10;
  for (const s of slides) if (s.template === "big-stat" && num(s.stat?.value)) return { value: String(s.stat!.value), label: String(s.stat!.label || s.stat!.text || "").slice(0, 80) };
  for (const s of slides) if ((s.template === "chart-trend") && num(s.stat?.value)) return { value: String(s.stat!.value), label: String(s.stat!.label || "").slice(0, 80) };
  for (const s of slides) if (s.template === "stats-row") { const it = (s.items || []).find((i) => num(i.value)); if (it) return { value: String(it.value), label: String(it.label || it.title || "").slice(0, 80) }; }
  return undefined;
}
