/**
 * Picks 2–3 recipes from the library as INSPIRATION for one slide. Mechanical retrieval only:
 * match the slide's role and visual kind, prefer recipes that fit the image's shape, and spread
 * different recipes across the deck. The designer AI still designs the slide itself.
 */
import { RECIPES, type Recipe } from "./recipes";
import type { Asset, OutlineSlide } from "../types";

const ROLE_SYNONYMS: Record<string, string[]> = {
  title: ["title"],
  agenda: ["agenda", "outline"],
  outline: ["agenda", "outline"],
  introduction: ["introduction", "problem", "concept", "statement", "objectives"],
  objectives: ["objectives", "aims", "scope"],
  concept: ["concept", "definition", "anatomy"],
  definition: ["definition", "concept"],
  principle: ["formula", "principle", "concept", "law"],
  process: ["process", "method", "steps", "cycle"],
  method: ["process", "method", "steps"],
  methodology: ["process", "method", "steps", "architecture"],
  architecture: ["architecture", "system", "layers", "hub"],
  design: ["architecture", "system", "layers"],
  comparison: ["comparison", "compare", "table"],
  data: ["data", "stat", "statistic", "chart", "numbers"],
  results: ["data", "stat", "chart", "summary"],
  case: ["case", "image", "applications", "examples"],
  applications: ["applications", "examples", "case", "features"],
  advantages: ["advantages", "comparison", "limitations"],
  history: ["timeline", "history", "milestones", "biography"],
  timeline: ["timeline", "history", "milestones"],
  quote: ["quote", "statement"],
  section: ["section", "statement"],
  summary: ["summary", "conclusion", "takeaways"],
  conclusion: ["summary", "conclusion", "takeaways"],
  closing: ["closing", "thanks", "questions"],
  references: ["summary"],
  code: ["code", "algorithm", "programming", "implementation"],
  problem: ["problem", "solution", "motivation"],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function pickRecipes(slide: OutlineSlide, assets: Asset[], used: Map<string, number>, k = 3): Recipe[] {
  const role = (slide.role || "").toLowerCase();
  const text = `${slide.role} ${slide.title} ${slide.keyMessage} ${slide.points.map((p) => p.text).join(" ")}`.toLowerCase();
  const wanted = new Set([role, ...(ROLE_SYNONYMS[role] || [])]);
  // content hints
  if (/\bvs\.?\b|versus|compar|differen/.test(text)) ["comparison", "compare"].forEach((t) => wanted.add(t));
  if (/algorithm|code|function|pseudo|program/.test(text)) wanted.add("code");
  if (/\d{4}\b.*\d{4}\b|history|milestone|timeline/.test(text)) wanted.add("timeline");
  if (/=|equation|formula|law\b/.test(text)) wanted.add("formula");
  if (/advantage|benefit|limitation|disadvantage|pros|cons/.test(text)) wanted.add("advantages");
  if (/application|uses|used in|examples?/.test(text)) wanted.add("applications");
  if (/architecture|module|layer|component/.test(text)) wanted.add("architecture");
  const img = assets.find((a) => a.origin !== "upload" && a.forSlides.includes(slide.n));
  const shape = img ? (img.width / img.height > 1.25 ? "landscape" : img.width / img.height < 0.85 ? "portrait" : "square") : null;
  const visual = slide.visual?.kind;

  const scored = RECIPES.map((r) => {
    let s = 0;
    for (const t of r.tags) if (wanted.has(t)) s += t === role ? 6 : 3;
    const needsPhoto = /asset:img/.test(r.html);
    if (img) s += needsPhoto ? 2 : -1;
    else if (needsPhoto) s -= 4; // the slide has no photo; a photo-led recipe is still usable as technique, but rank it lower
    if (shape && r.tags.includes(shape)) s += 1.5;
    if ((visual === "diagram" || visual === "chart") && r.tags.some((t) => ["diagram", "chart", "process", "architecture", "cycle", "hub"].includes(t))) s += 2;
    if (role !== "title" && r.tags[0] === "title") s -= 6;
    if (role !== "closing" && r.tags[0] === "closing") s -= 6;
    s -= 2.5 * (used.get(r.id) || 0); // variety across the deck
    s += hash(`${slide.n}:${r.id}`) * 1.5; // stable tie-break
    return { r, s };
  }).sort((a, b) => b.s - a.s);

  const out: Recipe[] = [];
  for (const { r } of scored) {
    if (out.length >= k) break;
    out.push(r);
  }
  for (const r of out) used.set(r.id, (used.get(r.id) || 0) + 1);
  return out;
}
