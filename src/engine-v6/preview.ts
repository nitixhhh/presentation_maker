/**
 * Engine v6 — live previews for the STYLE step: THIS deck's title slide and one content slide, rendered in each
 * proposed style from tokens alone (no AI per option, no photo search — the title uses its no-photo layout).
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { renderSlide } from "../engine-v5/render";
import { fitSlide } from "../engine-v5/fit";
import { themeDesignSystem } from "../engine-v5/themes";
import { templateById, type RenderCtx, type SlideContent } from "../engine-v5/templates";
import { buildStyle, fontPairV6, type StyleTokens } from "./style";
import type { PlannedSlide } from "../engine-v5/planner";
import { prepareChart } from "./charts";
import { prepareFlowchart } from "./flow";

/** the content slide that shows a style best: a diagram or data layout first, else cards */
export function previewSlideOf(slides: PlannedSlide[]): PlannedSlide | undefined {
  const content = slides.filter((s) => s.n > 1 && !["references", "closing", "agenda", "section"].includes(s.template) && templateById(s.template)?.photo !== "required");
  const rank = (s: PlannedSlide) => {
    const f = templateById(s.template)?.family || "";
    return ["data", "stat"].includes(f) ? 0 : ["diagram", "process", "timeline"].includes(f) ? 1 : f === "cards" ? 2 : 3;
  };
  return content.sort((a, b) => rank(a) - rank(b) || a.n - b.n)[0];
}

export interface StylePreview { id: string; files: string[] }

export async function renderStylePreviews(
  styles: StyleTokens[],
  plan: { slides: PlannedSlide[]; title: string; language: string; deckType: string; fields: { label: string; value: string }[] },
  outDir: string
): Promise<StylePreview[]> {
  fs.mkdirSync(path.join(outDir, "render"), { recursive: true });
  const title = plan.slides.find((s) => s.n === 1);
  const body = previewSlideOf(plan.slides);
  const deckIcons = [...new Set(plan.slides.flatMap((s) => (s.items || []).map((i) => i.icon)).filter((x): x is string => !!x && !/sparkles|circle|check|info/.test(x)))].slice(0, 3);
  const out: StylePreview[] = [];
  for (const tok of styles) {
    const built = buildStyle(tok);
    const design = themeDesignSystem(built.theme, plan.language, { font: fontPairV6(tok, plan.language), css: built.css });
    const deck: any = { assets: [], design, engine: "v6" };
    const files: string[] = [];
    for (const sl of [title, body].filter(Boolean) as PlannedSlide[]) {
      let c: SlideContent = { ...sl, template: sl.n === 1 ? (sl.template === "title-type" ? "title-type" : "title-split") : sl.template, photo: undefined, cites: [] };
      // the same drawings the deck will have (charts and flowcharts are code-drawn, no AI)
      c = await prepareFlowchart(prepareChart(c), design);
      const ctx: RenderCtx = { theme: built.theme, deckTitle: plan.title, n: sl.n, total: plan.slides.length, fields: sl.n === 1 ? plan.fields : [], logo: false, language: plan.language, deckType: plan.deckType, deckIcons } as RenderCtx;
      const html = renderSlide(c, ctx);
      const fit = await fitSlide(deck, sl.n, html, path.join(outDir, "render"), { shot: true });
      if (!fit.screenshot) continue;
      const f = path.join(outDir, `${tok.id}-${sl.n}.jpg`);
      await sharp(fit.screenshot).resize(800, 450).jpeg({ quality: 80, mozjpeg: true }).toFile(f);
      files.push(f);
    }
    out.push({ id: tok.id, files });
  }
  return out;
}
