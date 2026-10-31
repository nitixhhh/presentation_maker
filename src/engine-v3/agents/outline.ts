/** Engine v3 — Story / outline agent. */
import { chatJson } from "../llm";
import type { Brief, Outline, OutlineSlide, ResearchPack } from "../types";

const SYSTEM = `You are the Story agent of an academic presentation studio. Plan the slide-by-slide story for a class presentation.
Rules:
- Follow the brief's requiredSections in order. Exactly the requested number of slides.
- Slide 1 is the title slide (role "title"). The last content slide before the closing is role "references" (its points are filled by the engine — leave points empty). The final slide is role "closing" (Thank you / Questions) unless the slide count is very small.
- Every content slide: a short title (max 7 words), ONE keyMessage sentence (the takeaway), and 2–5 points. Each point max 16 words, concrete, exam-useful. Attach factIds for every point that uses a researched fact. Do not state numbers/dates/claims that are not in the facts.
- A point may be a label + explanation in the form "Label: explanation".
- visual: decide what the slide should SHOW:
  "photo" = a real photograph of a CONCRETE, physical subject helps (instrument, hardware, place, organism, real-world use). Never for abstract ideas (benefits, outcomes, objectives) — use diagram/none there. Give query = 2–4 plain English words for Wikimedia Commons (e.g. "UV-Vis spectrophotometer", "RFID tag", "library bookshelves").
  "generated" = a conceptual illustration no real photo can show; give prompt (one sentence, photographic or 3D-render style, no text in image).
  "diagram" = a process, architecture, block diagram, cycle, flowchart, hierarchy or comparison drawn with shapes; give idea = what boxes/arrows/labels to draw.
  "chart" = numeric data from the facts; give idea = which numbers (from facts only).
  "none" = typography alone is stronger.
  Use real photos generously (title slide usually gets a strong "photo" hero), vary visuals across the deck; never two "none" in a row.
- notes: 2–4 sentences the presenter can say (speaker notes), in the deck language.
- Language: write titles/points/notes in the requested language (Hindi = Devanagari; Hinglish = Hindi words in Roman script with English technical terms). The visual.query/prompt/idea stay in English.
Reply with ONLY JSON: {"slides":[{"n":1,"role":"title","title":"","keyMessage":"","points":[{"text":"","factIds":["F1"]}],"visual":{"kind":"photo","query":"","prompt":"","idea":""},"notes":""}]}`;

export async function runOutline(brief: Brief, research: ResearchPack): Promise<Outline> {
  const facts = research.facts.map((f) => `${f.id}: ${f.text}`).join("\n");
  const terms = research.keyTerms.map((k) => `${k.term} — ${k.meaning}`).join("\n");
  const user = `BRIEF
Title: ${brief.title}${brief.subtitle ? ` — ${brief.subtitle}` : ""}
Deck type: ${brief.deckType}; level: ${brief.level}; goal: ${brief.goal}
Language: ${brief.language}
Slide count: ${brief.slideCount}
Required sections (in order): ${brief.requiredSections.join(" → ")}
Tone: ${brief.tone}
Imagery: ${brief.imagery}

RESEARCHED FACTS (cite by id)
${facts || "(no facts found — keep points general and conceptual, no numbers)"}

KEY TERMS
${terms}`;

  const { data } = await chatJson<Outline>("outline", [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ], { temperature: 0.5, maxTokens: 9000, label: "outline" });

  const factIds = new Set(research.facts.map((f) => f.id));
  let slides: OutlineSlide[] = (data.slides || []).map((s: any, i: number) => ({
    n: i + 1,
    role: String(s.role || "concept").toLowerCase(),
    title: stripFactIds(String(s.title || "").trim()) || brief.title,
    keyMessage: stripFactIds(String(s.keyMessage || "").trim()),
    points: (Array.isArray(s.points) ? s.points : [])
      .map((p: any) => (typeof p === "string" ? { text: p } : p))
      .filter((p: any) => p?.text)
      .map((p: any) => ({ text: stripFactIds(String(p.text)), factIds: (p.factIds || []).filter((id: string) => factIds.has(id)) })),
    visual: { kind: s.visual?.kind || "none", query: s.visual?.query, prompt: s.visual?.prompt, idea: s.visual?.idea },
    notes: s.notes || "",
  }));
  if (!slides.length) throw new Error("Outline agent returned no slides");
  if (slides[0].role !== "title") slides[0].role = "title";
  // a slide the model titled "References" (e.g. "References & Thank You") IS the references slide: the engine fills it
  // with the real collected sources — never let the designer write generic ones like "Course textbook"
  if (!slides.some((s) => s.role === "references") && research.sources.length) {
    const r = slides.findIndex((s, i) => i > 0 && /referenc|bibliograph|works cited|sources|संदर्भ/i.test(s.title));
    if (r > 0) slides[r] = { ...slides[r], role: "references", points: [], visual: { kind: "none" } };
  }
  if (!slides.some((s) => s.role === "references") && research.sources.length) {
    const closingIdx = slides.findIndex((s) => s.role === "closing");
    const ref: OutlineSlide = { n: 0, role: "references", title: brief.language === "Hindi" ? "संदर्भ (References)" : "References", keyMessage: "", points: [], visual: { kind: "none" } };
    if (closingIdx > 0) slides.splice(closingIdx, 0, ref);
    else slides.push(ref);
  }
  slides = slides.map((s, i) => ({ ...s, n: i + 1 }));
  return { slides };
}

/** Remove fact ids the model sometimes leaks into text: "(F12)", "(F2, F9)", "[F3]", "F9–F11". */
export function stripFactIds(t: string): string {
  return t
    .replace(/\s*[\(\[]\s*F\d+(?:\s*[-–,;]\s*F?\d+)*\s*[\)\]]/g, "")
    .replace(/\bF\d+(?:\s*[-–]\s*F\d+)?\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}
