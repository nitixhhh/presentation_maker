/** Engine v3 — render + measure + deterministic auto-fit + contrast check for one slide. */
import sharp from "sharp";
import { openSlide, closePage } from "../render/browser";
import { slideDocument } from "../render/document";
import { MEASURE_JS, HIDE_JS, UNHIDE_JS, SHRINK_JS, SERIALIZE_JS, NUDGE_JS, WRAP_JS, CONTRAST_FIX_JS } from "../render/domScripts";
import { GEOMETRY_JS, GEOMETRY_FIX_JS } from "../render/geometry";
import { contrast } from "../agents/artDirector";
import { LOGO_GUARD_JS, LOGO_MAX } from "./logoGuard";
import { deckLogo } from "../assets/logo";
import type { Deck, QaIssue } from "../types";

export interface Measure {
  texts: any[];
  images: any[];
  issues: (QaIssue & { id?: string })[];
  words: number;
}

export interface Inspection {
  html: string; // possibly auto-fixed
  issues: QaIssue[];
  autoFixes: string[];
  screenshot: Buffer; // jpeg 1280x720
}

export function unresolve(html: string, assetBase: string, deck: Pick<Deck, "assets">): string {
  let out = html;
  for (const a of deck.assets) out = out.split(`${assetBase}${a.file}`).join(`asset:${a.id}`);
  return out;
}

/** Numbers that appear on the slide but in none of the content it was given → probably invented. */
function inventedNumbers(texts: any[], allowed: string, n: number): string[] {
  const seen = new Set<string>();
  const ok = new Set((allowed.match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(",", ".")));
  const out: string[] = [];
  for (const t of texts) {
    const s = t.lines.map((l: any[]) => l.map((r) => r.t).join("")).join(" ");
    if ((t.opacity ?? 1) < 0.5 || s.trim().length <= 3) continue; // decorative numerals
    const clean = s.replace(/\[\d+(?:[,–-]\d+)*\]/g, " ");
    for (const raw of clean.match(/\d+(?:[.,]\d+)?/g) || []) {
      const v = raw.replace(",", ".");
      if (ok.has(v) || Number(v) === n || Number(v) <= 10 || seen.has(v)) continue;
      seen.add(v);
      out.push(raw);
    }
  }
  return out;
}

/** issue types that mean the layout is physically broken (overlap / cut off / covered) — code decides, never the AI */
export const LAYOUT_TYPES = new Set(["text-clipped", "out-of-canvas", "text-past-panel", "text-overlap", "text-covered", "label-overlap", "line-over-text", "label-clipped"]);
/** issues GEOMETRY_JS reports (also "small-label") */
export const GEOMETRY_TYPES = new Set(["label-overlap", "line-over-text", "label-clipped", "text-covered", "small-label"]);

export async function inspectSlide(
  deck: Pick<Deck, "assets" | "design">,
  n: number,
  html: string,
  renderDir: string,
  role = "",
  allowedText = "",
  opts: { enforce?: boolean; fixContrast?: boolean } = {}
): Promise<Inspection> {
  const assetBase = "../assets/";
  const doc = slideDocument(deck.design, html, { assetBase, deck, n });
  const page = await openSlide(doc, renderDir, `qa-${String(n).padStart(2, "0")}`);
  const autoFixes: string[] = [];
  try {
    // hard logo guard first: never a background / hero / large picture; only title + closing slides place it themselves
    const logo = deckLogo(deck as { assets: any[] });
    if (logo) {
      const lf: string[] = await page.evaluate(`(${LOGO_GUARD_JS})(${JSON.stringify({ allowed: logo.forSlides.includes(n), maxW: LOGO_MAX.w, maxH: LOGO_MAX.h })})`);
      autoFixes.push(...lf);
    }
    // long URLs / DOIs / unbreakable tokens may break inside their column instead of pushing it out of its panel
    const wrapped: string[] = await page.evaluate(WRAP_JS);
    autoFixes.push(...wrapped);
    let m: Measure = await page.evaluate(MEASURE_JS);
    // deterministic auto-fit (max 3 passes)
    for (let pass = 0; pass < 3; pass++) {
      const ids = m.issues.filter((i) => (i.type === "text-clipped" || i.type === "out-of-canvas" || i.type === "text-past-panel") && i.id).map((i) => i.id!);
      const pairs = m.issues.filter((i) => i.type === "text-overlap" && i.id).map((i) => i.id!.split("|"));
      if (!ids.length && !pairs.length) break;
      const nudged: string[] = pairs.length ? await page.evaluate(`(${NUDGE_JS})(${JSON.stringify(pairs)})`) : [];
      const changed: string[] = ids.length ? await page.evaluate(`(${SHRINK_JS})(${JSON.stringify(ids)})`) : [];
      if (!changed.length && !nudged.length) break;
      autoFixes.push(...changed.map((c) => `shrink ${c}`), ...nudged.map((c) => `nudge ${c}`));
      m = await page.evaluate(MEASURE_JS);
    }
    // geometry: SVG labels, lines/arrows over text, labels cut off or too small (exact element + coordinates)
    let g: { issues: (QaIssue & { id?: string })[] } = await page.evaluate(GEOMETRY_JS);
    if (opts.enforce) {
      // last resort after the AI rounds: deterministic fixes, re-measured each pass until the code finds nothing
      for (let pass = 0; pass < 4; pass++) {
        const geo = g.issues.filter((i) => i.id && i.severity === "high" && i.type !== "small-label").map((i) => ({ type: i.type, id: i.id }));
        const ids = m.issues.filter((i) => (i.type === "text-clipped" || i.type === "out-of-canvas" || i.type === "text-past-panel") && i.id).map((i) => i.id!);
        const pairs = m.issues.filter((i) => i.type === "text-overlap" && i.id).map((i) => i.id!.split("|"));
        if (!geo.length && !ids.length && !pairs.length) break;
        const fixed: string[] = geo.length ? await page.evaluate(`(${GEOMETRY_FIX_JS})(${JSON.stringify(geo)})`) : [];
        const nudged: string[] = pairs.length ? await page.evaluate(`(${NUDGE_JS})(${JSON.stringify(pairs)})`) : [];
        const changed: string[] = ids.length ? await page.evaluate(`(${SHRINK_JS})(${JSON.stringify(ids)})`) : [];
        if (!fixed.length && !nudged.length && !changed.length) break;
        autoFixes.push(...fixed, ...nudged.map((c) => `nudge ${c}`), ...changed.map((c) => `shrink ${c}`));
        m = await page.evaluate(MEASURE_JS);
        g = await page.evaluate(GEOMETRY_JS);
      }
    }
    m.issues.push(...g.issues);
    let fixedHtml = html;
    if (autoFixes.length) fixedHtml = unresolve(await page.evaluate(SERIALIZE_JS), assetBase, deck);

    let screenshot = await page.screenshot({ type: "jpeg", quality: 80 });

    // contrast: hide native text, look at the pixels underneath each text block
    let issues: QaIssue[] = m.issues.map(({ type, detail, severity }) => ({ type, detail, severity }));
    if (allowedText && role !== "references") {
      const inv = inventedNumbers(m.texts, allowedText, n);
      if (inv.length) issues.push({ type: "invented-number", severity: "high", detail: `These numbers are not in the content you were given and look invented: ${inv.slice(0, 6).join(", ")}. Remove them (never invent data, chart values, costs or dates).` });
    }
    // placeholder contact details (emails, web addresses, phone numbers) that nobody gave the designer
    if (role !== "references") {
      const all = m.texts.map((t: any) => t.lines.map((l: any[]) => l.map((r) => r.t).join("")).join(" ")).join(" | ");
      const found = [...(all.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []), ...(all.match(/\b(?:https?:\/\/|www\.)\S+/gi) || []), ...(all.match(/\+?\d[\d\s-]{8,}\d/g) || [])].filter((x) => !allowedText.includes(x));
      if (found.length) issues.push({ type: "placeholder-contact", severity: "high", detail: `Remove these contact details — nobody gave them, they look like placeholders: ${found.slice(0, 3).join(", ")}. Never invent emails, phone numbers, websites or names.` });
    }
    if (role === "references") issues = issues.filter((i) => !["tiny-text", "small-body", "small-label", "too-much-text", "sparse"].includes(i.type));
    const nativeTexts = m.texts.filter((t) => t.native && t.w > 4 && t.h > 4);
    // decorative numerals / watermarks (very short or faded text) are not reading text
    const readable = (t: any) => (t.opacity ?? 1) > 0.5 && t.lines.map((l: any[]) => l.map((r) => r.t).join("")).join(" ").trim().length > 3;
    const pct = (xs: number[], p: number) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length * p)] : 99);
    /** contrast of each readable text block with the pixels underneath it (native text hidden for the shot) */
    const measureContrast = async (list: any[]) => {
      if (!list.length) return [];
      await page.evaluate(`(${HIDE_JS})(${JSON.stringify({ texts: list.map((t) => t.id), images: [] })})`);
      const bg = await page.screenshot({ type: "png" });
      await page.evaluate(UNHIDE_JS);
      const { data, info } = await sharp(bg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const out: { t: any; avg: number; worst: number; need: number; white: number; dark: number; txt: string }[] = [];
      for (const t of list.filter(readable)) {
        const x0 = Math.max(0, Math.floor(t.x)), y0 = Math.max(0, Math.floor(t.y));
        const x1 = Math.min(info.width, Math.ceil(t.x + t.w)), y1 = Math.min(info.height, Math.ceil(t.y + t.h));
        if (x1 - x0 < 2 || y1 - y0 < 2) continue;
        let sum = 0, cnt = 0;
        const lums: number[] = [], wh: number[] = [], dk: number[] = [];
        const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 400)));
        for (let y = y0; y < y1; y += step)
          for (let x = x0; x < x1; x += step) {
            const i = (y * info.width + x) * 3;
            const hex = `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
            const c = contrast(`#${t.color}`, hex);
            lums.push(c);
            wh.push(contrast("#ffffff", hex));
            dk.push(contrast("#111111", hex));
            sum += c;
            cnt++;
          }
        const large = t.fontSize >= 30 || (t.fontSize >= 24 && t.lines?.[0]?.[0]?.s?.weight >= 700);
        out.push({
          t,
          avg: sum / Math.max(1, cnt),
          worst: pct(lums, 0.15), // 15th percentile — ignores tiny specks
          need: large ? 3 : 4.5,
          white: pct(wh, 0.15),
          dark: pct(dk, 0.15),
          txt: t.lines.map((l: any[]) => l.map((r) => r.t).join("")).join(" ").slice(0, 50),
        });
      }
      return out;
    };
    const contrastIssues = (found: Awaited<ReturnType<typeof measureContrast>>): QaIssue[] =>
      found.flatMap((f) =>
        f.avg < f.need
          ? [{ type: "low-contrast", severity: "high", detail: `Text "${f.txt}" has low contrast with what is behind it (≈${f.avg.toFixed(1)}:1, needs ${f.need}:1).` } as QaIssue]
          : f.worst < f.need * 0.8
          ? [{ type: "busy-background", severity: "medium", detail: `Text "${f.txt}" sits partly on a busy/low-contrast area (worst ≈${f.worst.toFixed(1)}:1) — add a scrim/panel or move it.` } as QaIssue]
          : []
      );
    let found = await measureContrast(nativeTexts);
    if (opts.fixContrast) {
      // last resort after the AI rounds: readable ink (white / near-black) where one works, otherwise a scrim plate
      const bad = found.filter((f) => f.avg < f.need || f.worst < f.need * 0.8);
      if (bad.length) {
        const fixes = bad.map((f) => {
          const ink = f.white >= f.dark ? "#ffffff" : "#111111";
          const best = Math.max(f.white, f.dark);
          return best >= f.need ? { id: f.t.id, mode: "recolor", ink } : { id: f.t.id, mode: "plate", ink, plate: ink === "#ffffff" ? "rgba(10,12,18,0.72)" : "rgba(255,255,255,0.86)" };
        });
        const done: string[] = await page.evaluate(`(${CONTRAST_FIX_JS})(${JSON.stringify(fixes)})`);
        if (done.length) {
          autoFixes.push(...done);
          fixedHtml = unresolve(await page.evaluate(SERIALIZE_JS), assetBase, deck);
          const m2: Measure = await page.evaluate(MEASURE_JS);
          found = await measureContrast(m2.texts.filter((t) => t.native && t.w > 4 && t.h > 4));
          screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
        }
      }
    }
    issues.push(...contrastIssues(found));
    return { html: fixedHtml, issues, autoFixes, screenshot };
  } finally {
    await closePage(page);
  }
}
