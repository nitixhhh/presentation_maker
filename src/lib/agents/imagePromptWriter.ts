import { ToolLoop } from "@/lib/ai/toolLoop";
import { ImagePromptOutput, ImagePromptOutputSchema } from "@/schemas/agents";
import { VisualElement } from "@/schemas/presentation";
import { ToolExecutor } from "@/lib/tools";

export class ImagePromptWriterAgent {
  public static async execute(
    slideIndex: number,
    topic: string,
    slideTitle: string,
    imageSource: "ai" | "stock" | "none"
  ): Promise<VisualElement> {
    if (imageSource === "none") {
      return { type: "none" };
    }

    const systemPrompt = `You are a Visual Concept and Image Prompt Specialist.
Your mission is to generate visual prompts for presentations.
Produce both:
1. "fluxPrompt": detailed cinematic prompt for FLUX Schnell AI image generator
2. "stockKeywords": 2-3 focused keywords for searching stock photography (Unsplash/Pexels)

You MUST return JSON with this exact shape:
{
  "action": "final_output",
  "data": {
    "slideIndex": ${slideIndex},
    "fluxPrompt": "detailed cinematic prompt",
    "stockKeywords": ["keyword1", "keyword2"],
    "aspectRatio": "16:9"
  }
}`;

    const userPrompt = `TOPIC: ${topic}
SLIDE ${slideIndex} TITLE: ${slideTitle}

Generate the optimal image prompt and stock search terms.`;

    try {
      const output = await ToolLoop.run<ImagePromptOutput>({
        agentName: "ImagePromptWriter",
        systemPrompt,
        userPrompt,
        outputSchema: ImagePromptOutputSchema,
        availableTools: ["search_stock_images"],
      });

      if (imageSource === "ai") {
        const genResult = await ToolExecutor.execute("generate_image", {
          prompt: output.fluxPrompt,
          style: "hyper-realistic, modern cinematic, 8k",
        });
        if (genResult.success && genResult.data?.imageUrl) {
          return {
            type: "image",
            url: genResult.data.imageUrl,
            alt: slideTitle,
            caption: "AI Generated Visual",
          };
        }
      }

      // Stock image search
      const keyword = output.stockKeywords[0] || topic;
      const stockResult = await ToolExecutor.execute("search_stock_images", { query: keyword });
      if (stockResult.success && stockResult.data?.length > 0) {
        const photo = stockResult.data[0];
        return {
          type: "image",
          url: photo.url,
          alt: photo.alt || slideTitle,
          credit: photo.author,
        };
      }
    } catch (e) {
      console.warn(`[ImagePromptWriterAgent] Error on slide ${slideIndex}:`, e);
    }

    // Curated high quality visual fallback
    return {
      type: "image",
      url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      alt: slideTitle,
      credit: "Unsplash Studio",
    };
  }
}
