/** Engine v3 — Brief agent: understands the user's goal and required format. */
import { chatJson } from "../llm";
import type { Brief, V3Request } from "../types";
import { presenterFields } from "../privacy";

const SYSTEM = `You are the Brief agent of an academic presentation studio used by Indian university students (B.Tech, B.Sc, MCA, MBA …).
Turn the user's request into a precise production brief. Think like a senior student who knows what faculty expect.

Rules:
- Infer the deck type: "subject seminar", "project presentation / review", "lab / experiment report", "case study", "lecture", "business pitch", etc.
- requiredSections: the ordered list of sections this kind of academic deck needs. If the user gave a format (formatNotes), FOLLOW IT EXACTLY and in their order.
  Typical project review: Title, Introduction, Problem Statement, Objectives, Literature Review / Existing System, Proposed System, System Architecture, Methodology / Modules, Tech Stack (Hardware & Software), Results / Screens, Conclusion, Future Scope, References, Thank You.
  Typical subject seminar: Title, Introduction, Principle / Theory, Instrumentation or Process, Applications, Advantages & Limitations, Summary, References, Thank You.
  The seminar list is a shape, not a script: "Instrumentation" fits only an instrument or lab technique. For a natural process, concept, event or technology use sections that fit THAT topic (e.g. photosynthesis → Overview, Light Reactions, Calvin Cycle, C3 / C4 / CAM, Factors Affecting the Rate, Importance; blockchain in supply chain → The Problem, How Blockchain Works, Use in the Supply Chain, Case Studies, Benefits & Challenges). Section names must read like real slide titles for this topic, never generic placeholders.
  Fit the list to the requested slide count (title + references + closing count as slides). Merge or drop sections when the count is small.
- researchQueries: 3–5 short English search queries (Wikipedia / scholarly search) that would find authoritative material. For a project topic include the core technologies (e.g. "RFID library management", "integrated library system").
- language: English, Hindi (Devanagari script) or Hinglish (Hindi in Roman script). Keep technical terms in English.
- referenceStyle: "APA 7" unless the user asked for something else (IEEE, Harvard…).
- imagery: one sentence on what real photos/visuals would help this audience (lab instruments, real hardware, campus library, molecules …).
Reply with ONLY JSON:
{"title":"","subtitle":"","deckType":"","subject":"","level":"","goal":"","language":"English","slideCount":10,"requiredSections":[],"referenceStyle":"APA 7","tone":"","researchQueries":[],"imagery":""}`;

export async function runBrief(req: V3Request): Promise<Brief> {
  // Student details never go into the AI prompt (free-tier terms): the title-slide fields are built in code from
  // exactly what the student typed; the AI only learns which kinds of details exist.
  const fields = presenterFields(req.presenter);
  const user = `Topic: ${req.topic}
Audience / class: ${req.audience || "(not given — infer)"}
Purpose: ${req.purpose || "(not given — infer)"}
Requested slide count: ${req.slideCount || "(not given — choose 10-12)"}
Language: ${req.language || "English"}
Style hint: ${req.styleHint || "(none)"}
Presenter details: ${fields.length ? `${fields.map((f) => f.label).join(", ")} (printed on the title slide by the engine)` : "(none given)"}
University / format instructions from the user:
${req.formatNotes?.trim() || "(none given)"}`;

  const { data } = await chatJson<Brief>("brief", [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ], { temperature: 0.3, maxTokens: 3000, label: "brief" });

  const slideCount = clamp(Number(req.slideCount) || Number(data.slideCount) || 10, 4, 25);
  return {
    title: data.title || req.topic,
    subtitle: data.subtitle || "",
    deckType: data.deckType || "subject seminar",
    subject: data.subject || req.topic,
    level: data.level || req.audience || "undergraduate",
    goal: data.goal || `Explain ${req.topic} clearly`,
    language: (req.language || data.language || "English") as Brief["language"],
    slideCount,
    requiredSections: Array.isArray(data.requiredSections) && data.requiredSections.length ? data.requiredSections : ["Title", "Introduction", "Key Concepts", "Applications", "Summary", "References"],
    titleSlideFields: fields,
    referenceStyle: data.referenceStyle || "APA 7",
    tone: data.tone || "clear, academic, confident",
    researchQueries: (Array.isArray(data.researchQueries) && data.researchQueries.length ? data.researchQueries : [req.topic]).slice(0, 5),
    imagery: data.imagery || "",
    styleHint: req.styleHint,
  };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, Math.round(n)));
}
