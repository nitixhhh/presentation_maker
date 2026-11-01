/**
 * Engine v4 — the design-skill library (src/engine-v4/skills/*.md) read on demand by the agents (read_skill),
 * instead of one giant prompt. Files are cached in memory after the first read.
 */
import fs from "fs";
import path from "path";

const cache = new Map<string, string>();

export function skillsRoot(): string {
  const env = process.env.V4_SKILLS_DIR;
  if (env && fs.existsSync(env)) return env;
  const cands = [path.join(process.cwd(), "src/engine-v4/skills")];
  try {
    cands.push(path.join(path.dirname(new URL(import.meta.url).pathname), "skills"));
  } catch {}
  return cands.find((c) => fs.existsSync(path.join(c, "INDEX.md"))) || cands[0];
}

/** every skill file name, e.g. "workflow.md", "layouts/timeline.md" */
export function listSkills(): string[] {
  const root = skillsRoot();
  const out: string[] = [];
  const walk = (d: string, pre: string) => {
    for (const f of fs.existsSync(d) ? fs.readdirSync(d).sort() : []) {
      if (f.startsWith("_") || f.startsWith(".")) continue;
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p, `${pre}${f}/`);
      else if (f.endsWith(".md")) out.push(`${pre}${f}`);
    }
  };
  walk(root, "");
  return out;
}

/** normalise what a model asks for: "timeline", "layouts/timeline", "skills/layouts/timeline.md", "Workflow.MD" … */
export function resolveSkill(name: string): string | null {
  const all = listSkills();
  let n = String(name || "").trim().replace(/^\.?\/?(skills\/)?/i, "").replace(/\\/g, "/").toLowerCase();
  if (!n) return null;
  if (!n.endsWith(".md")) n += ".md";
  const exact = all.find((f) => f.toLowerCase() === n);
  if (exact) return exact;
  const base = n.split("/").pop()!;
  const hit = all.find((f) => f.toLowerCase() === `layouts/${base}`) || all.find((f) => f.split("/").pop()!.toLowerCase() === base);
  if (hit) return hit;
  // fuzzy: "process" → layouts/process-steps.md, "comparison" → two-column-comparison.md
  const stem = base.replace(/\.md$/, "");
  return all.find((f) => f.toLowerCase().includes(stem)) || null;
}

export function readSkill(name: string): string {
  const f = resolveSkill(name);
  if (!f) return `Error: no skill named "${name}". Available: ${listSkills().join(", ")}`;
  if (!cache.has(f)) cache.set(f, fs.readFileSync(path.join(skillsRoot(), f), "utf8"));
  return cache.get(f)!;
}

/** layout ids the planner may assign (one file per layout under skills/layouts) */
export function layoutIds(): string[] {
  return listSkills().filter((f) => f.startsWith("layouts/")).map((f) => f.slice(8, -3));
}

let examples: string[] | null = null;
/** sample sentences inside the skills' HTML skeletons — they must never end up on a real slide */
export function skeletonTexts(): string[] {
  if (examples) return examples;
  const out = new Set<string>();
  for (const f of listSkills()) {
    const md = readSkill(f);
    for (const block of md.match(/```html[\s\S]*?```/g) || [])
      for (const m of block.matchAll(/>([^<>{}]{8,120})</g)) {
        const t = m[1].replace(/\s+/g, " ").trim();
        if (t.split(" ").length >= 3 && !/[{}]/.test(t)) out.add(t);
      }
  }
  examples = [...out];
  return examples;
}
