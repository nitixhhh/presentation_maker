import { ToolLoop } from "@/lib/ai/toolLoop";
import { ResearcherOutput, ResearcherOutputSchema } from "@/schemas/agents";
import { PresentationRequest } from "@/schemas/presentation";

export class ResearcherAgent {
  public static async execute(request: PresentationRequest): Promise<ResearcherOutput> {
    const systemPrompt = `You are the Lead Strategic Researcher agent for an AI Presentation Maker.
Your role is to deeply research the given topic and create a powerful, compelling presentation outline with punchy data points, historical facts, and a captivating narrative arc.

RULES:
1. Conduct research using the "web_search" tool if necessary.
2. Structure the presentation with an exciting narrative arc.
3. Exactly ${request.slideCount} slides must be outlined.
4. Adapt the language to ${request.language}. If Hinglish, use natural modern conversational Hindi + English mix.
5. You MUST return JSON with this exact shape:
{
  "action": "final_output",
  "data": {
    "executiveSummary": "string",
    "narrativeArc": "string",
    "keyThemes": ["theme 1", "theme 2"],
    "slideOutline": [
      {
        "slideIndex": 1,
        "suggestedLayout": "hero-title",
        "headline": "string",
        "coreMessage": "string",
        "dataPoints": ["stat 1"],
        "visualIdea": "string"
      }
    ]
  }
}`;

    const userPrompt = `TOPIC: ${request.topic}
AUDIENCE: ${request.audience}
TONE: ${request.tone}
DESIRED SLIDE COUNT: ${request.slideCount}
LANGUAGE: ${request.language}

Provide a complete strategic research outline.`;

    return await ToolLoop.run<ResearcherOutput>({
      agentName: "Researcher",
      systemPrompt,
      userPrompt,
      outputSchema: ResearcherOutputSchema,
      availableTools: ["web_search"],
    });
  }
}
