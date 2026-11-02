/** Engine v7 model bake-off: same concept + same slide prompt through several free models. */
import fs from "fs";
import path from "path";
import { llmContext } from "../src/engine-v3/llm";
import { research, writeStory, referencesFor } from "../src/engine-v7/content";
import { makeConcept } from "../src/engine-v7/concept";
import { resolveFonts } from "../src/engine-v7/fonts";
import { designSlide, slidePrompt } from "../src/engine-v7/slide";
import { finalDocument, renderSlide } from "../src/engine-v7/render";
import { closeBrowser } from "../src/engine-v3/render/browser";

const dir = process.argv[2];
const models = process.argv[3].split(",");
const which = (process.argv[4] || "2,5").split(",").map(Number);
fs.mkdirSync(dir, { recursive: true });
const log = (m: string) => console.log(new Date().toISOString().slice(11, 19), m);
(async () => {
  const req = { topic: "Bayes' Theorem", slideCount: 9, audience: "university students" };
  let saved: any;
  const cf = path.join(dir, "concept.json");
  if (fs.existsSync(cf)) saved = JSON.parse(fs.readFileSync(cf, "utf8"));
  else {
    const { brief, pack } = await research(req, log);
    const slides = await writeStory(req, brief, pack, log);
    const concept = await makeConcept(req, slides[0].title, slides, log);
    saved = { brief, pack, slides, concept, references: referencesFor(slides, pack) };
    fs.writeFileSync(cf, JSON.stringify(saved, null, 2));
  }
  const { slides, concept } = saved;
  const fr = await resolveFonts(concept.fonts, log);
  await Promise.all(models.map(async (m) => {
    const i = m.indexOf(":");
    for (const n of which) {
      const s = slides.find((x: any) => x.n === n);
      const prompt = slidePrompt(s, concept.storyboard.find((b: any) => b.n === n), concept, fr.fonts, [], concept.storyboard, slides[0].title, slides.length);
      const t = Date.now();
      try {
        const r = await llmContext.run({ routes: { design: [{ provider: m.slice(0, i), model: m.slice(i + 1) }] } }, () => designSlide(prompt, `bake ${m} ${n}`));
        const tag = `${m.replace(/[^a-z0-9.]+/gi, "_")}-s${n}`;
        const out = await renderSlide(finalDocument(r.html, fr.css), dir, tag);
        log(`${m} slide ${n}: ${Math.round((Date.now() - t) / 1000)} s, ${r.html.length} chars, issues ${out.report.issues.length}: ${out.report.issues.slice(0, 3).join(" | ").slice(0, 300)}`);
      } catch (e: any) {
        log(`${m} slide ${n}: FAILED after ${Math.round((Date.now() - t) / 1000)} s — ${String(e?.message || e).slice(0, 300)}`);
      }
    }
  }));
  await closeBrowser();
})();
