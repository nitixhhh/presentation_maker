/**
 * Engine v3 — Image director (AI). Decides, per slide, whether the slide gets
 *   - a REAL photo (Wikimedia Commons / Openverse, with attribution) — only where authenticity matters:
 *     real instruments, places, people, specimens/organisms, historical events, real products;
 *   - an AI image (Cloudflare Workers AI Flux) — concepts, covers, backgrounds, metaphors, illustrations;
 *   - or nothing (the designer uses typography / an HTML diagram).
 * It also writes ONE deck-level style prompt so every AI image in the deck looks like one family.
 * Code then only enforces the hard safety rule: AI images never show data, charts, text or labels.
 */
import { chatJson } from "../llm";
import type { Brief, OutlineSlide } from "../types";

export interface ImagePlanItem {
  n: number;
  source: "real" | "ai" | "none";
  /** search words for a real photo (English) */
  query?: string;
  /** what the AI image should depict (English, no style words — the deck style is added) */
  subject?: string;
  /** true when only a real photo is acceptable (never replace with an AI image) */
  authentic?: boolean;
  why?: string;
}

export interface ImagePlan {
  style: string;
  items: ImagePlanItem[];
}

const SYSTEM = `You are the art director of an academic presentation. You decide, for every slide, what kind of image it gets.
Choose per slide:
- "real": a real photograph found on Wikimedia Commons / Openverse. Use ONLY where authenticity matters: real instruments and lab equipment, real places and buildings, real people (scientists, historical figures), real specimens / organisms / minerals, historical events, real products and devices. Give "query": 2–5 precise English search words (e.g. "UV-Vis spectrophotometer", "Sundarbans mangrove forest", "C. V. Raman"). Set "authentic": true when a fake would mislead (a specific person, specimen, place or instrument).
- "ai": an AI-generated image. Use for concepts, metaphors, covers, section/background art, illustrations, everyday scenes and anything abstract. Give "subject": what to show in one sentence (objects, scene, composition), in English, without style words.
- "none": the slide is better with typography, a diagram, a chart or a table (e.g. data, comparisons, processes, formulas, references, agenda).
Hard rules:
- NEVER "ai" for anything that must be factually exact: data, charts, graphs, numbers, maps, labelled diagrams, formulas, text, screenshots, real named people, real specimens shown as evidence.
- AI subjects must not contain text, letters, numbers, labels, logos or charts.
- About half the slides or fewer get images; vary the deck; the title slide usually gets a strong image (AI cover in the deck style unless the topic is a real person/place/instrument).
- References and agenda slides: "none".
Also write "style": ONE style prompt applied to every AI image so they look like one family — medium (e.g. soft 3D render, editorial photo, flat vector illustration, watercolour), lighting, colour mood matching the deck, composition notes (clean background, space for text). 20–40 words, English.
Reply ONLY JSON: {"style":"","items":[{"n":1,"source":"ai","subject":"","query":"","authentic":false,"why":""}]}`;

export async function runImageDirector(brief: Brief, slides: OutlineSlide[], styleHint?: string): Promise<ImagePlan> {
  const list = slides
    .map((s) => `${s.n}. [${s.role}] ${s.title} — ${s.keyMessage || ""} | story agent suggested: ${s.visual.kind}${s.visual.query ? ` "${s.visual.query}"` : ""}${s.visual.prompt ? ` / "${s.visual.prompt}"` : ""}`)
    .join("\n");
  try {
    const { data } = await chatJson<ImagePlan & { items: any[] }>("plan", [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Deck: "${brief.title}" — ${brief.deckType} for ${brief.level}; subject ${brief.subject}; language ${brief.language}; tone ${brief.tone}.${styleHint ? ` The student asked for this look: ${styleHint}.` : ""}\nSlides:\n${list}`,
      },
    ], { temperature: 0.5, maxTokens: 3000, label: "image director" });
    const byN = new Map(slides.map((s) => [s.n, s]));
    const items: ImagePlanItem[] = (data.items || [])
      .filter((x: any) => byN.has(Number(x?.n)))
      .map((x: any) => ({
        n: Number(x.n),
        source: x.source === "real" || x.source === "ai" ? x.source : "none",
        query: x.query ? String(x.query).slice(0, 80) : undefined,
        subject: x.subject ? String(x.subject).slice(0, 300) : undefined,
        authentic: !!x.authentic,
        why: x.why ? String(x.why).slice(0, 160) : undefined,
      }));
    // mechanical guard: references/agenda never get images; data/chart slides never get AI images
    for (const it of items) {
      const s = byN.get(it.n)!;
      if (s.role === "references") it.source = "none";
      if (it.source === "ai" && (s.visual.kind === "chart" || s.role === "data")) it.source = "none";
      if (it.source === "real" && !it.query) it.query = (s.visual.query || s.title).slice(0, 80);
      if (it.source === "ai" && !it.subject) it.subject = s.visual.prompt || s.visual.idea || s.title;
    }
    restoreDroppedSlots(slides, items);
    return { style: String(data.style || "").slice(0, 400), items };
  } catch {
    // the AI call failed: keep the story agent's own suggestion per slide
    return {
      style: "",
      items: slides
        .filter((s) => s.visual.kind === "photo" || s.visual.kind === "generated")
        .map((s) => ({ n: s.n, source: s.visual.kind === "photo" ? "real" : "ai", query: s.visual.query || s.title, subject: s.visual.prompt || s.title })),
    };
  }
}

/**
 * The story agent asked for a photo / image on a slide but the image director's reply left that slide out (or said
 * "none" while the deck still has room for images): put the slot back, so a photo slide never silently loses its image.
 * References / agenda / chart / data slides stay without images; about half the deck at most carries images.
 */
export function restoreDroppedSlots(slides: OutlineSlide[], items: ImagePlanItem[]): number[] {
  const restored: number[] = [];
  const cap = Math.ceil(slides.length / 2) + 1;
  const withImage = () => items.filter((x) => x.source !== "none").length;
  for (const s of slides) {
    if (s.visual.kind !== "photo" && s.visual.kind !== "generated") continue;
    if (s.role === "references" || s.role === "agenda" || s.role === "data") continue;
    const it = items.find((x) => x.n === s.n);
    if (it && it.source !== "none") continue;
    if (it && withImage() >= cap) continue; // the director said "none" deliberately and the deck has enough images
    const real = s.visual.kind === "photo";
    const item: ImagePlanItem = { n: s.n, source: real ? "real" : "ai", query: (s.visual.query || s.title).slice(0, 80), subject: s.visual.prompt || s.visual.idea || s.title, authentic: false, why: "restored: the outline asked for an image here" };
    if (it) Object.assign(it, item);
    else items.push(item);
    restored.push(s.n);
  }
  items.sort((a, b) => a.n - b.n);
  return restored;
}

/** The hard rule for AI images, appended mechanically to every prompt. */
export const AI_IMAGE_SAFETY = "no text, no letters, no numbers, no labels, no captions, no charts, no graphs, no logos, no watermark";
