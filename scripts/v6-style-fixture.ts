/** Engine v6 — style fixture: renders a few templates in given token sets (no AI). npx tsx scripts/v6-style-fixture.ts <out> <tokens.json> */
import { prepareChart } from "../src/engine-v6/charts";
import { prepareFlowchart } from "../src/engine-v6/flow";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { renderSlide } from "../src/engine-v5/render";
import { fitSlide } from "../src/engine-v5/fit";
import { themeDesignSystem } from "../src/engine-v5/themes";
import { TEMPLATES, type SlideContent } from "../src/engine-v5/templates";
import { buildStyle, fontPairV6, type StyleTokens } from "../src/engine-v6/style";
import { closeBrowser } from "../src/engine-v3/render/browser";

const out = process.argv[2];
const toks: StyleTokens[] = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const lang = process.env.LANG_DECK || "English";
const FIX: Record<string, Partial<SlideContent>> = { ...JSON.parse(fs.readFileSync(path.join(__dirname, "v5-fixture.json"), "utf8"))[lang], ...(process.env.EXTRA ? JSON.parse(fs.readFileSync(process.env.EXTRA, "utf8")) : {}) };
const only = (process.env.ONLY || "title-split,stats-row,hub,chart-trend,closing").split(",");
(async () => {
  fs.mkdirSync(path.join(out, "render"), { recursive: true });
  for (const tok of toks) {
    const b = buildStyle(tok);
    console.log(tok.name, JSON.stringify(b.fixes), b.checks.filter((c) => c.ratio < c.min).map((c) => c.pair).join(",") || "all pass");
    const design = themeDesignSystem(b.theme, lang, { font: fontPairV6(tok, lang), css: b.css });
    let n = 0;
    for (const id of only) {
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) continue;
      n++;
      const c = await prepareFlowchart(prepareChart({ template: id, title: "Untitled", ...(FIX[id] || {}) } as SlideContent), design);
      const html = renderSlide({ ...c, photo: undefined }, { theme: b.theme, deckTitle: "The Economics of Inequality: Is Wealth Distribution More Important Than Growth?", n, total: 8, fields: [{ label: "Presented by", value: "Nitish Yadav" }, { label: "Roll No.", value: "135" }, { label: "Course", value: "Business" }, { label: "Institute", value: "Brainware University" }], logo: false, language: lang, deckType: "Class presentation", deckIcons: ["lucide:scale", "lucide:coins", "lucide:users"], heroStat: process.env.NOSTAT ? undefined : { value: "32.5%", label: "of US wealth is held by the top 1%" }, references: [{ n: 1, text: "Piketty, T. (2014). Capital in the Twenty-First Century. Harvard University Press." }] } as any);
      const fit = await fitSlide({ assets: [], design, engine: "v6" } as any, n, html, path.join(out, "render"), { shot: true });
      if (fit.overflow.length) console.log("  overflow", id, JSON.stringify(fit.overflow));
      await sharp(fit.screenshot!).jpeg({ quality: 80 }).toFile(path.join(out, `${tok.id}-${String(n).padStart(2, "0")}-${id}.jpg`));
    }
  }
  await closeBrowser();
})();
