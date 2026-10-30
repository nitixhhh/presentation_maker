import { z } from "zod";

export const LanguageSchema = z.enum(["English", "Hindi", "Hinglish"]);
export type Language = z.infer<typeof LanguageSchema>;

export const VisualStyleSchema = z.enum([
  "modern-dark",
  "editorial-clean",
  "vibrant-gradient",
  "corporate-sleek",
  "minimal-zen",
  "tech-cyber",
  "warm-earthy",
]);
export type VisualStyle = z.infer<typeof VisualStyleSchema>;

export const LayoutTypeSchema = z.enum([
  "hero-title",
  "split-content-image",
  "big-stat-callout",
  "three-card-grid",
  "four-card-grid",
  "comparison-pros-cons",
  "horizontal-timeline",
  "vertical-process",
  "quote-highlight",
  "full-bleed-visual",
  "chart-visualization",
  "mermaid-diagram",
  "code-walkthrough",
  "matrix-2x2",
  "problem-solution",
  "key-takeaways",
  "agenda-outline",
  "testimonial-social-proof",
  "features-breakdown",
  "step-by-step-guide",
  "pyramid-hierarchy",
  "funnel-conversion",
  "team-showcase",
  "pricing-table",
  "closing-cta",
]);
export type LayoutType = z.infer<typeof LayoutTypeSchema>;

export const ColorPaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: z.string(), // Hex or hsl
  surface: z.string(),
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  text: z.string(),
  mutedText: z.string(),
  border: z.string(),
});
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

export const FontPairSchema = z.object({
  id: z.string(),
  name: z.string(),
  headingFont: z.string(),
  bodyFont: z.string(),
  googleFontUrl: z.string(),
  supportsHindi: z.boolean().default(false),
});
export type FontPair = z.infer<typeof FontPairSchema>;

export const DesignDnaSchema = z.object({
  seed: z.number(),
  palette: ColorPaletteSchema,
  fontPair: FontPairSchema,
  visualStyle: VisualStyleSchema,
  motif: z.string().describe("Visual motif such as rounded-glass, sharp-geometric, subtle-mesh, or organic-curves"),
  layoutSequence: z.array(LayoutTypeSchema),
});
export type DesignDna = z.infer<typeof DesignDnaSchema>;

export const VisualElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    url: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
    credit: z.string().optional(),
  }),
  z.object({
    type: z.literal("chart"),
    chartType: z.enum(["bar", "line", "pie", "radar", "scatter"]),
    echartsOption: z.record(z.string(), z.any()),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("diagram"),
    kind: z.enum(["flowchart", "timeline", "mindmap", "architecture", "sequence"]),
    mermaidSyntax: z.string(),
  }),
  z.object({
    type: z.literal("code"),
    language: z.string(),
    snippet: z.string(),
    highlightLines: z.array(z.number()).optional(),
  }),
  z.object({
    type: z.literal("stat"),
    number: z.string(),
    label: z.string(),
    supportingText: z.string().optional(),
  }),
  z.object({
    type: z.literal("cards"),
    items: z.array(
      z.object({
        icon: z.string().optional(),
        title: z.string(),
        description: z.string(),
      })
    ),
  }),
  z.object({
    type: z.literal("comparison"),
    leftHeader: z.string(),
    leftPoints: z.array(z.string()),
    rightHeader: z.string(),
    rightPoints: z.array(z.string()),
  }),
  z.object({
    type: z.literal("quote"),
    quote: z.string(),
    author: z.string(),
    role: z.string().optional(),
  }),
  z.object({
    type: z.literal("none"),
  }),
]);
export type VisualElement = z.infer<typeof VisualElementSchema>;

export const SlideSchema = z.object({
  id: z.string(),
  slideNumber: z.number(),
  layoutType: LayoutTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  bodyPoints: z.array(z.string()).default([]),
  visualElement: VisualElementSchema,
  speakerNotes: z.string().default(""),
});
export type Slide = z.infer<typeof SlideSchema>;

export const PresentationRequestSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters"),
  audience: z.string().default("General audience"),
  tone: z.string().default("Professional & Engaging"),
  slideCount: z.number().int().min(3).max(20).default(7),
  language: LanguageSchema.default("English"),
  visualStyle: VisualStyleSchema.optional(),
  fontPairId: z.string().optional(),
  paletteId: z.string().optional(),
  imageSource: z.enum(["ai", "stock", "none"]).default("stock"),
  toggles: z
    .object({
      charts: z.boolean().default(true),
      diagrams: z.boolean().default(true),
      codeBlocks: z.boolean().default(false),
      icons: z.boolean().default(true),
      speakerNotes: z.boolean().default(true),
    })
    .default({
      charts: true,
      diagrams: true,
      codeBlocks: false,
      icons: true,
      speakerNotes: true,
    }),
});
export type PresentationRequest = z.infer<typeof PresentationRequestSchema>;

export const PresentationDeckSchema = z.object({
  id: z.string(),
  orderId: z.string().optional(),
  topic: z.string(),
  request: PresentationRequestSchema,
  designDna: DesignDnaSchema,
  slides: z.array(SlideSchema),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.any()).default({}),
});
export type PresentationDeck = z.infer<typeof PresentationDeckSchema>;
