/**
 * Engine v7 — the concept step. Like a human designer before touching a slide: the AI decides this deck's own art
 * direction (palette, type, motif, image style, mood) and sketches every slide's visual idea. There is no list of
 * presets or layouts to pick from; everything is written fresh for the topic.
 */
import fs from "fs";
import path from "path";
import { chat, extractJson } from "../engine-v3/llm";
import type { V7Concept, V7Request, V7Slide } from "./types";

const CONCEPT_SYSTEM = `You are an award-winning presentation designer starting a new deck on a blank canvas (1920x1080 slides, rendered as HTML/CSS/SVG).
First invent the deck's CONCEPT for this specific topic and audience, then sketch a storyboard: how each slide will explain its idea visually.

Before deciding, brainstorm three genuinely different directions for this topic (different medium or metaphor, different colour family, different type genre — e.g. one photographic, one typographic, one illustrated), each born from the topic itself. Then choose the strongest one that is also clearly different from the RECENT DECKS listed by the user, and develop it.

The concept (all free choices — there is no preset list; do not default to a "dark tech" or "corporate blue" look unless the topic truly calls for it):
Avoid the generic AI-slide look: no default dark navy/slate background with glowing cyan lines, no glassmorphism, no purple-blue gradients, no "cards with icons" everywhere. A dark look is fine only when it is a specific, topic-born idea (e.g. a darkroom, the deep sea, a night sky), never the default. Each deck should feel like a different human designer made it.
- conceptName: 2–5 words naming the idea behind the look (e.g. a metaphor drawn from the topic itself).
- artDirection: one rich paragraph a designer could follow: the feeling, background treatment, how type is used, how much white space, how diagrams are drawn (line weight, fills, hand-drawn or geometric), how photos are treated, what makes this deck unmistakable.
- palette: 4–6 colours with hex and what each is for (background, ink, accent…). Text/background pairs must have strong contrast.
- fonts: Google Fonts family names that exist on fonts.google.com — a display face with character and a readable body face (an optional accent/mono face). Avoid Inter/Roboto/Arial/Poppins/Montserrat unless they fit the concept unusually well.
- motif: one recurring visual element that ties the deck together (a line, a shape, a texture, a framing device, a number style…), described concretely.
- imageStyle: one sentence describing how ALL AI images in this deck look (medium, lighting, colour grade, framing), so they are consistent. Describe only the picture itself — never frames, borders, captions or labels (those are drawn in HTML around the image). It may be photographic, illustrated, painterly, 3D, macro, etc. — whatever fits the concept.

The storyboard (one entry per slide):
- visual: the specific visual that makes THIS idea click — invented for this idea, not a generic layout. Think like a teacher with a whiteboard and a designer's eye: a diagram drawn in SVG (Venn, tree, flow, cycle, cross-section, number line, timeline, map, balance, funnel, network…), a chart drawn from the real numbers in the body, one huge number or formula as hero typography, a worked example, a code block, a photo metaphor, a split comparison, an annotated image… Use the real content of the slide.
- composition: where things sit on the 1920x1080 canvas (e.g. "formula centred huge, three annotations below linked by thin lines", "photo bleeds full-frame, title knocked out bottom-left").
- image: {"subject": what the AI picture shows (concrete objects, scene, no words), "aspect": "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9"} or null. Use an AI image where a picture beats a diagram (a metaphor, a real-world scene, a mood, a cover). When the concept uses imagery, plan 3–MAX_IMAGES images; never more than MAX_IMAGES. Image subjects must contain NO writing: avoid keyboards, signs, screens, books with readable pages, labelled machines, maps with names — the image model paints garbled letters on them. Diagrams and typography are drawn in code and need no image.
Rules for the storyboard: every slide must look like it was designed for its own idea; no two slides share the same composition; vary scale, density and rhythm across the deck (some slides dense with a diagram, some almost empty with one big statement). The cover sets the concept boldly. The references slide is designed too (calm, readable, on-concept).
Reply with ONLY JSON: {"directions":["","",""],"conceptName":"","artDirection":"","palette":[{"hex":"#000000","use":""}],"fonts":{"display":"","body":"","accent":""},"motif":"","imageStyle":"","storyboard":[{"n":1,"visual":"","composition":"","image":null}]}`;

/** Recently made decks (site-wide memory) so a new deck never repeats the last looks. */
const recentFile = () => path.join(process.env.DECKCRAFT_DATA_DIR || "/tmp", "v7-recent-concepts.json");
export function recentConcepts(): { name: string; look: string }[] {
  try { return JSON.parse(fs.readFileSync(recentFile(), "utf8")); } catch { return []; }
}
export function rememberConcept(c: V7Concept) {
  const look = `background ${c.palette[0]?.hex || "?"}, accents ${c.palette.slice(1, 4).map((p) => p.hex).join(" ")}, fonts ${c.fonts.display} / ${c.fonts.body}${c.fonts.accent ? " / " + c.fonts.accent : ""}; ${c.artDirection.slice(0, 220)}`;
  const list = [{ name: c.conceptName, look }, ...recentConcepts().filter((r) => r.name !== c.conceptName)].slice(0, 8);
  try { fs.mkdirSync(path.dirname(recentFile()), { recursive: true }); fs.writeFileSync(recentFile(), JSON.stringify(list, null, 2)); } catch {}
}

export async function makeConcept(req: V7Request, title: string, slides: V7Slide[], log: (m: string) => void): Promise<V7Concept> {
  const maxImages = Math.max(0, Math.min(5, req.aiImages ?? 5));
  const recent = recentConcepts();
  const user = `${recent.length ? `RECENT DECKS made on this site — yours must look clearly different from every one of them (different background colour family, different font families, different motif and medium):\n${recent.map((r) => `- "${r.name}": ${r.look}`).join("\n")}\n\n` : ""}Topic: ${req.topic}
Deck title: ${title}
Audience: ${req.audience || "university students"}
${req.styleHint ? `The user's style wish: ${req.styleHint}\n` : ""}Slides:
${slides.map((s) => `${s.n}. ${s.title}\n   idea: ${s.idea}\n   body: ${s.body.replace(/\n/g, " / ")}`).join("\n")}`;
  const meta = await chat("art", [
    { role: "system", content: CONCEPT_SYSTEM.replace(/MAX_IMAGES/g, String(maxImages)) },
    { role: "user", content: user },
  ], { temperature: 0.9, maxTokens: 14000, timeoutMs: 300_000, label: "v7 concept", validate: (t) => {
    try { const j: any = extractJson(t); return Array.isArray(j?.storyboard) && j.storyboard.length > 0; }
    catch { if (process.env.V7_DEBUG_DIR) try { fs.writeFileSync(`${process.env.V7_DEBUG_DIR}/unusable-concept-${Date.now()}.txt`, t); } catch {} return false; }
  } });
  const data = extractJson<V7Concept>(meta.text);
  log(`concept: "${data.conceptName}" (${meta.provider}:${meta.model}, ${Math.round(meta.ms / 1000)} s)`);
  // keep at most maxImages image requests, in storyboard order
  let left = maxImages;
  const board = slides.map((s) => {
    const b = (data.storyboard || []).find((x) => Number(x.n) === s.n) || { n: s.n, visual: "", composition: "" };
    const img = b.image && b.image.subject && left > 0 ? (left--, { subject: String(b.image.subject), aspect: String(b.image.aspect || "16:9") }) : null;
    return { n: s.n, visual: String(b.visual || ""), composition: String(b.composition || ""), image: img };
  });
  if (Array.isArray((data as any).directions)) log(`concept directions considered: ${(data as any).directions.map((d: any) => String(d).slice(0, 70)).join(" | ")}`);
  const concept: V7Concept = {
    conceptName: String(data.conceptName || ""),
    artDirection: String(data.artDirection || ""),
    palette: (data.palette || []).filter((p) => /^#[0-9a-f]{3,8}$/i.test(String(p.hex || "").trim())).slice(0, 7),
    fonts: { display: String(data.fonts?.display || "Fraunces"), body: String(data.fonts?.body || "Source Sans 3"), accent: data.fonts?.accent ? String(data.fonts.accent) : undefined },
    motif: String(data.motif || ""),
    imageStyle: String(data.imageStyle || ""),
    storyboard: board,
  };
  rememberConcept(concept);
  return concept;
}

export function fontsLink(c: V7Concept): string {
  const fams = [c.fonts.display, c.fonts.body, c.fonts.accent].filter(Boolean) as string[];
  const uniq = [...new Set(fams.map((f) => f.trim()))];
  const q = uniq.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=block`;
}
