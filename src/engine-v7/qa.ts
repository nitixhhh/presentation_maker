/**
 * Engine v7 — self-check. A vision model looks at the rendered slide (plus the in-page measurements) and lists
 * concrete problems; it does not judge the design against any template, only whether it is finished and readable.
 */
import { chatJson } from "../engine-v3/llm";
import type { V7Slide } from "./types";

export interface Verdict { score: number; fix: boolean; problems: string[]; route: string }

export async function reviewSlide(jpg: Buffer, slide: V7Slide, domIssues: string[], label: string): Promise<Verdict | null> {
  const prompt = `You are a strict senior designer checking slide ${slide.n} ("${slide.title}") before it goes to a client. The slide is a rendered 1920x1080 image.
Its intended idea: ${slide.idea}
Check ONLY for real defects:
- any text cut off, overflowing, clipped by an edge or container, or overlapping other text or a shape so that it is hard to read
- low contrast or text sitting on a busy part of an image without a backing
- text too small to read from the back of a room
- broken visuals: arrows/lines not connecting, labels detached from what they label, chart bars/values that do not match, an empty or half-drawn area, a missing image, placeholder text
- garbled, misspelled or fake writing inside a picture
- the slide looks unfinished, cramped, lopsided or like a plain web page instead of a designed slide
- the visual does not help explain the idea
- a header/footer strip or decoration repeated as page chrome, or wobbly hand-drawn lines that look messy rather than designed
- a large blank region that makes the slide look empty or unfinished (a planned grid, chart or picture only partly drawn)
Measured automatically in the page (trust these; they are exact): ${domIssues.length ? domIssues.join(" | ") : "no measured problems"}.
Score 1–10 (8 = ready for a client; 9–10 = excellent). fix=true if anything above is wrong or score < 8.
List at most 5 problems, each naming the element and the exact change to make (e.g. "the subtitle under the formula touches the bottom edge: move it up 60px or reduce it to 34px").
Reply ONLY JSON: {"score":8,"fix":false,"problems":["..."]}`;
  try {
    const { data, meta } = await chatJson<{ score: number; fix: boolean; problems: string[] }>("vision", [
      { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpg.toString("base64")}` } }] },
    ], { temperature: 0.1, maxTokens: 2500, timeoutMs: 180_000, label });
    const score = Math.max(1, Math.min(10, Number(data.score) || 5));
    const problems = (data.problems || []).map(String).filter(Boolean).slice(0, 6);
    return { score, fix: !!data.fix || score < 8 || domIssues.some((d) => /cut off|clipped|overflows/.test(d)), problems, route: `${meta.provider}:${meta.model}` };
  } catch {
    return null;
  }
}

/** Does an AI picture contain writing (letters, numbers, signs, garbled glyphs)? */
export async function imageHasText(jpg: Buffer, subject: string): Promise<{ text: boolean; fits: boolean } | null> {
  try {
    const { data } = await chatJson<{ text: boolean; fits: boolean }>("vision", [
      { role: "user", content: [
        { type: "text", text: `Look at this picture. 1) Does it contain ANY writing: letters, words, numbers, signs, captions, logos, or garbled text-like marks? 2) Does it reasonably show: "${subject}"? Reply ONLY JSON: {"text":false,"fits":true}` },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpg.toString("base64")}` } },
      ] },
    ], { temperature: 0, maxTokens: 400, timeoutMs: 90_000, label: "v7 image check" });
    return { text: !!data.text, fits: data.fits !== false };
  } catch {
    return null;
  }
}
