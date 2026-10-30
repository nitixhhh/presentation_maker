/**
 * Engine v2 — AI Director Agent
 *
 * Orchestrates the presentation's narrative arc, chooses design tokens (mood, style, seed),
 * and assigns optimal layout structures from the 12-layout registry.
 */

import { AIClient } from "@/lib/ai/client";
import type { SlideRole } from "../layouts/types";
import type { Mood } from "../designSystem/generator";
import { planLayoutSequence, getLayout } from "../layouts/registry";

export interface DirectorRequest {
  topic: string;
  audience?: string;
  tone?: string;
  slideCount?: number;
  language?: "English" | "Hindi" | "Hinglish";
  visualStyle?: string;
  seed?: number;
}

export interface PlannedSlideObjective {
  index: number;
  role: SlideRole;
  layoutId: string;
  variant: number;
  objective: string;
  visualIntent: "diagram" | "image" | "stat" | "cards" | "none";
}

export interface DirectorDeckPlan {
  topic: string;
  title: string;
  mood: Mood;
  language: string;
  seed: number;
  narrativeArc: string;
  slides: PlannedSlideObjective[];
}

export class DirectorAgent {
  public static async planDeck(request: DirectorRequest): Promise<DirectorDeckPlan> {
    const slideCount = Math.max(3, Math.min(8, request.slideCount || 5));
    const seed = request.seed || Math.floor(Math.random() * 100000);
    const audience = request.audience || "General Audience";
    const tone = request.tone || "Professional, Insightful & Actionable";

    const systemPrompt = `You are an elite Presentation Director and Executive Storyteller.
Your mission is to construct a compelling narrative arc for a presentation deck.

RULES:
1. First slide MUST have role "cover".
2. Second slide MUST have role "agenda".
3. Mid-deck slides (slides 2 to N-2) MUST BE RICH & VISUAL:
   - Include at least one "process" or "diagram" slide (e.g. step-by-step mechanism, pipeline, or scientific flow).
   - Include at least one "comparison" or "data" slide (e.g. 3 key application pillars or 4 feature cards).
   - Include at least one "stat" slide (KPI numbers or core quantitative metrics).
   - DO NOT USE MORE THAN ONE "statement" ROLE IN THE ENTIRE DECK. NEVER TWO IN A ROW.
4. Final slide MUST have role "takeaways" or "cta".
5. Return ONLY a valid JSON object matching this exact structure:
{
  "deckTitle": "Punchy Title",
  "narrativeArc": "One sentence summary of the story arc",
  "recommendedMood": "techy" | "bold" | "warm" | "elegant" | "corporate" | "playful" | "calm" | "editorial",
  "slides": [
    {
      "role": "cover" | "agenda" | "statement" | "stat" | "comparison" | "process" | "timeline" | "data" | "diagram" | "takeaways" | "cta",
      "objective": "What key point this slide proves or illustrates",
      "visualIntent": "diagram" | "image" | "stat" | "cards" | "none"
    }
  ]
}`;

    const userPrompt = `TOPIC: "${request.topic}"
AUDIENCE: ${audience}
TONE: ${tone}
TARGET SLIDE COUNT: ${slideCount}
LANGUAGE: ${request.language || "English"}

Plan the complete ${slideCount}-slide narrative structure.`;

    try {
      const response = await AIClient.complete("ArtDirector", [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], { temperature: 0.6 });

      const cleaned = response.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const aiRoles: SlideRole[] = (parsed.slides || []).map((s: any) => s.role as SlideRole);

      // Enforce layout variety through the seeded layout planner
      const plannedLayouts = planLayoutSequence(aiRoles.slice(0, slideCount), seed);

      const finalSlides: PlannedSlideObjective[] = plannedLayouts.map((plan, i) => {
        const aiSlide = parsed.slides?.[i] || {};
        return {
          index: i,
          role: (aiSlide.role as SlideRole) || (i === 0 ? "cover" : i === slideCount - 1 ? "takeaways" : "statement"),
          layoutId: plan.layoutId,
          variant: plan.variant,
          objective: aiSlide.objective || `Slide ${i + 1} content`,
          visualIntent: aiSlide.visualIntent || (plan.layoutId.includes("image") ? "image" : "diagram"),
        };
      });

      return {
        topic: request.topic,
        title: parsed.deckTitle || request.topic,
        mood: (parsed.recommendedMood as Mood) || "editorial",
        language: request.language === "Hindi" ? "hi" : request.language === "Hinglish" ? "hinglish" : "en",
        seed,
        narrativeArc: parsed.narrativeArc || "Comprehensive topic exploration",
        slides: finalSlides,
      };
    } catch (err) {
      console.warn("[DirectorAgent] Fallback to deterministic outline:", err);
      // Fallback deterministic sequence
      const defaultRoles: SlideRole[] = ["cover", "agenda", "process", "stat", "takeaways"];
      const actualRoles = defaultRoles.slice(0, slideCount);
      const planned = planLayoutSequence(actualRoles, seed);

      return {
        topic: request.topic,
        title: request.topic,
        mood: "warm",
        language: "en",
        seed,
        narrativeArc: "Overview, Core Mechanics & Key Action Items",
        slides: planned.map((p, i) => ({
          index: i,
          role: actualRoles[i],
          layoutId: p.layoutId,
          variant: p.variant,
          objective: `Deliver key insight for step ${i + 1}`,
          visualIntent: i === 0 ? "image" : i === 2 ? "diagram" : "stat",
        })),
      };
    }
  }
}

