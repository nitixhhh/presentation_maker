import { ToolLoop } from "@/lib/ai/toolLoop";
import { ArtDirectorOutput, ArtDirectorOutputSchema } from "@/schemas/agents";
import { PresentationRequest } from "@/schemas/presentation";
import { generateLayoutSequence } from "@/lib/design/layouts";
import { getRandomPalette, getPaletteById } from "@/lib/design/palettes";
import { getFontPairForLanguage, getFontPairById } from "@/lib/design/fonts";

export class ArtDirectorAgent {
  public static async execute(
    request: PresentationRequest,
    researchSummary: string,
    seed: number = Date.now()
  ): Promise<ArtDirectorOutput> {
    // Determine base palette & font
    const basePalette = request.paletteId ? getPaletteById(request.paletteId) || getRandomPalette(seed) : getRandomPalette(seed);
    const baseFont = request.fontPairId
      ? getFontPairById(request.fontPairId) || getFontPairForLanguage(request.language, seed)
      : getFontPairForLanguage(request.language, seed);
    const layoutSequence = generateLayoutSequence(request.slideCount, request.toggles);

    const systemPrompt = `You are the Art Director agent for an elite presentation studio.
Your mission is to establish the "Design DNA" of the presentation. Every deck must look stunning, high-contrast, modern, and visually memorable. No two decks should look generic.

RULES:
1. Review the topic and research summary to determine an evocative visual theme.
2. Select or customize the color palette and font pairing provided.
3. Assign a specific recommended visual type (chart, diagram, image, stat, cards, code, quote) for every slide in the layout sequence.
4. Provide concrete visual style directives for each slide.
5. You MUST return JSON with this exact shape:
{
  "action": "final_output",
  "data": {
    "designThemeName": "string",
    "rationale": "string",
    "palette": ${JSON.stringify(basePalette)},
    "fontPair": ${JSON.stringify(baseFont)},
    "visualStyle": "${request.visualStyle || "modern-dark"}",
    "motif": "rounded-glass-mesh",
    "layoutSequence": ${JSON.stringify(layoutSequence)},
    "slideVisualDirectives": [
      {
        "slideIndex": 1,
        "layoutType": "hero-title",
        "recommendedVisualType": "image",
        "visualStyleNotes": "string"
      }
    ]
  }
}`;

    const userPrompt = `TOPIC: ${request.topic}
RESEARCH SUMMARY: ${researchSummary}
LANGUAGE: ${request.language}
SUGGESTED PALETTE: ${JSON.stringify(basePalette)}
SUGGESTED FONT: ${JSON.stringify(baseFont)}
LAYOUT SEQUENCE: ${JSON.stringify(layoutSequence)}

Return the complete Art Director design blueprint.`;

    try {
      return await ToolLoop.run<ArtDirectorOutput>({
        agentName: "ArtDirector",
        systemPrompt,
        userPrompt,
        outputSchema: ArtDirectorOutputSchema,
        availableTools: ["get_palette", "pick_fonts"],
      });
    } catch (err) {
      console.warn("[ArtDirectorAgent] Falling back to programmatic Design DNA:", err);
      return {
        designThemeName: `${request.visualStyle || "Modern Cyber"} Architecture`,
        rationale: "Selected dynamic high-contrast theme optimized for readability and visual impact.",
        palette: basePalette,
        fontPair: baseFont,
        visualStyle: request.visualStyle || "modern-dark",
        motif: "rounded-glass-mesh",
        layoutSequence,
        slideVisualDirectives: layoutSequence.map((layout, idx) => ({
          slideIndex: idx + 1,
          layoutType: layout,
          recommendedVisualType: idx === 0 ? "image" : idx === 1 ? "stat" : idx === 2 ? "cards" : "image",
          visualStyleNotes: "High visual contrast with gradient typography and elevated card containers.",
        })),
      };
    }
  }
}
