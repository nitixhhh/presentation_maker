import { ToolLoop } from "@/lib/ai/toolLoop";
import { SlideWriterOutput, SlideWriterOutputSchema } from "@/schemas/agents";
import { PresentationRequest } from "@/schemas/presentation";
import { ArtDirectorOutput, ResearcherOutput } from "@/schemas/agents";

export class SlideWriterAgent {
  public static async execute(
    request: PresentationRequest,
    research: ResearcherOutput,
    artDirection: ArtDirectorOutput
  ): Promise<SlideWriterOutput> {
    const systemPrompt = `You are the Lead Presentation Copywriter and Storyteller.
Your mission is to write concise, punchy, persuasive copy for each slide in the deck.

CRITICAL RULES:
1. NEVER create generic "title + bullet dump" slides. Write impactful headlines that convey an active conclusion.
2. Max 3-4 bullet points per slide. Each bullet point MUST be under 16 words.
3. Every slide MUST include comprehensive speaker notes (2-4 sentences) with verbal cues and storytelling tips for the presenter.
4. Language MUST strictly be ${request.language}. If Hinglish, write natural high-energy Hindi + English phrasing.
5. Follow the layout sequence specified by the Art Director.
6. You MUST return JSON with this exact shape:
{
  "action": "final_output",
  "data": {
    "deckTitle": "string",
    "slides": [
      {
        "slideIndex": 1,
        "layoutType": "hero-title",
        "title": "string",
        "subtitle": "string",
        "bodyPoints": ["point 1", "point 2"],
        "speakerNotes": "string"
      }
    ]
  }
}`;

    const userPrompt = `TOPIC: ${request.topic}
AUDIENCE: ${request.audience}
TONE: ${request.tone}
RESEARCH OUTLINE: ${JSON.stringify(research.slideOutline)}
ART DIRECTION LAYOUTS: ${JSON.stringify(artDirection.layoutSequence)}

Draft the complete slide copy for all ${artDirection.layoutSequence.length} slides.`;

    return await ToolLoop.run<SlideWriterOutput>({
      agentName: "SlideWriter",
      systemPrompt,
      userPrompt,
      outputSchema: SlideWriterOutputSchema,
      availableTools: ["get_icons"],
    });
  }
}
