/** Engine v3 — vision critique of a rendered slide. */
import { chatJson } from "../llm";
import type { OutlineSlide, QaIssue } from "../types";

export interface VisionVerdict {
  score: number;
  fix: boolean;
  issues: string[];
}

export async function visionReview(screenshot: Buffer, slide: OutlineSlide, domIssues: QaIssue[], deckTitle: string): Promise<VisionVerdict | null> {
  const prompt = `You are the strict art director reviewing slide ${slide.n} ("${slide.title}", role ${slide.role}) of a university class deck about "${deckTitle}". Look at the rendered 1280×720 slide.
Judge like a professional designer and a professor:
- readability from the back of a classroom (size, contrast, text over busy photo areas)
- anything cut off, overlapping, crammed, or touching edges; awkward empty areas; misaligned elements
- empty boxes/panels, placeholder text, broken or irrelevant images, plain unstyled photo dropped in a box
- does it look intentionally designed (hierarchy, whitespace, image treatment) — not like a generic template
- diagram/chart clarity (labels legible, arrows connect, nothing floating)
Automatic measurements already found: ${domIssues.length ? domIssues.map((i) => i.detail).join(" | ") : "none"}.
Score 1–10 (7 = good enough to present, 9 = excellent). Set fix=true if score < 7 or anything is cut off/overlapping/unreadable/broken.
List concrete, actionable issues (max 5), each naming the element and what to change.
Reply ONLY JSON: {"score":8,"fix":false,"issues":["..."]}`;
  try {
    const { data } = await chatJson<VisionVerdict>("vision", [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshot.toString("base64")}` } },
        ],
      },
    ], { temperature: 0.1, maxTokens: 2500, timeoutMs: 180_000, label: `vision qa ${slide.n}` });
    const score = Math.max(1, Math.min(10, Number(data.score) || 5));
    return { score, fix: !!data.fix || score < 7, issues: (data.issues || []).map(String).slice(0, 6) };
  } catch {
    return null; // vision optional — DOM checks still run
  }
}
