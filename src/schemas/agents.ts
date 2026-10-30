import { z } from "zod";
import {
  LayoutTypeSchema,
  ColorPaletteSchema,
  FontPairSchema,
  VisualStyleSchema,
  VisualElementSchema,
} from "./presentation";

// --- RESEARCHER SCHEMAS ---
export const ResearchKeyPointSchema = z.object({
  title: z.string(),
  factOrData: z.string().describe("Specific metric, stat, historical reference, or punchy insight"),
  sourceOrContext: z.string().optional(),
});

export const ResearcherOutputSchema = z.object({
  executiveSummary: z.string(),
  narrativeArc: z.string().describe("Storyline flow from hook to climax to call to action"),
  keyThemes: z.array(z.string()).min(2),
  slideOutline: z.array(
    z.object({
      slideIndex: z.number(),
      suggestedLayout: LayoutTypeSchema,
      headline: z.string(),
      coreMessage: z.string(),
      dataPoints: z.array(z.string()),
      visualIdea: z.string(),
    })
  ),
});
export type ResearcherOutput = z.infer<typeof ResearcherOutputSchema>;

// --- ART DIRECTOR SCHEMAS ---
export const ArtDirectorOutputSchema = z.object({
  designThemeName: z.string(),
  rationale: z.string(),
  palette: ColorPaletteSchema,
  fontPair: FontPairSchema,
  visualStyle: VisualStyleSchema,
  motif: z.string(),
  layoutSequence: z.array(LayoutTypeSchema),
  slideVisualDirectives: z.array(
    z.object({
      slideIndex: z.number(),
      layoutType: LayoutTypeSchema,
      recommendedVisualType: z.enum([
        "image",
        "chart",
        "diagram",
        "code",
        "stat",
        "cards",
        "comparison",
        "quote",
        "none",
      ]),
      visualStyleNotes: z.string(),
    })
  ),
});
export type ArtDirectorOutput = z.infer<typeof ArtDirectorOutputSchema>;

// --- SLIDE WRITER SCHEMAS ---
export const SlideDraftSchema = z.object({
  slideIndex: z.number(),
  layoutType: LayoutTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  bodyPoints: z.array(z.string()).max(4).describe("Concise, punchy bullet items. Never wall of text"),
  visualElementInitial: VisualElementSchema.optional(),
  speakerNotes: z.string().describe("Detailed presenter script with storytelling cues"),
});

export const SlideWriterOutputSchema = z.object({
  deckTitle: z.string(),
  slides: z.array(SlideDraftSchema),
});
export type SlideWriterOutput = z.infer<typeof SlideWriterOutputSchema>;

// --- DIAGRAM & CODE SPECIALIST SCHEMAS ---
export const DiagramCodeRequestSchema = z.object({
  slideIndex: z.number(),
  type: z.enum(["chart", "diagram", "code"]),
  promptContext: z.string(),
  preferredFormat: z.string().optional(),
});

export const DiagramCodeOutputSchema = z.object({
  slideIndex: z.number(),
  visualElement: VisualElementSchema,
});
export type DiagramCodeOutput = z.infer<typeof DiagramCodeOutputSchema>;

// --- IMAGE PROMPT WRITER SCHEMAS ---
export const ImagePromptOutputSchema = z.object({
  slideIndex: z.number(),
  fluxPrompt: z.string().describe("Detailed prompt tailored for FLUX schnell high-aesthetic rendering"),
  stockKeywords: z.array(z.string()).describe("Curated search terms for Unsplash/Pexels"),
  aspectRatio: z.enum(["16:9", "4:3", "1:1"]).default("16:9"),
});
export type ImagePromptOutput = z.infer<typeof ImagePromptOutputSchema>;

// --- VISION QA SCHEMAS ---
export const QaSlideFeedbackSchema = z.object({
  slideIndex: z.number(),
  hasTextOverflow: z.boolean(),
  contrastPass: z.boolean(),
  wcagEstimatedRatio: z.number().optional(),
  visualBalanceRating: z.number().min(1).max(10),
  critique: z.string(),
  suggestedFixes: z.array(z.string()),
});

export const VisionQAOutputSchema = z.object({
  overallScore: z.number().min(1).max(100),
  passed: z.boolean(),
  criticalIssues: z.array(z.string()),
  slideFeedbacks: z.array(QaSlideFeedbackSchema),
  ownerActionPlan: z.string(),
});
export type VisionQAOutput = z.infer<typeof VisionQAOutputSchema>;
