/**
 * Engine v2 — AI SlideWriter Agent
 *
 * Fills layout slots with high-impact copywriting, structured KPIs,
 * and bespoke AI diagram specifications tailored directly to the topic.
 */

import { AIClient } from "@/lib/ai/client";
import type { LayoutDefinition, SlotContent } from "../layouts/types";
import { generateAIImage } from "../assets/imageGenerator";
import { buildDynamicDiagramShapes, type AIDiagramSpec } from "../diagrams/dynamicDiagramBuilder";
import type { DesignSystemTokens, Shape } from "../sceneGraph";

export interface SlideWriterRequest {
  topic: string;
  audience: string;
  slideIndex: number;
  totalSlides: number;
  layout: LayoutDefinition;
  variant: number;
  objective: string;
  visualIntent: string;
  language: string;
  ds: DesignSystemTokens;
}

export interface SlideWriterResult {
  slotContent: Record<string, SlotContent>;
  extraShapes?: Shape[];
  speakerNotes: string;
}

export class SlideWriterAgent {
  public static async writeSlide(request: SlideWriterRequest): Promise<SlideWriterResult> {
    const { topic, audience, slideIndex, layout, objective, language, ds } = request;
    const slotNames = Object.keys(layout.slots);

    const systemPrompt = `You are a World-Class Executive Presentation Copywriter & Visual Architect.
Your mission is to write punchy, memorable slide copy and structured visual data for slide ${slideIndex + 1}.

LAYOUT TO FILL: "${layout.id}"
SLOT NAMES REQUIRED: ${JSON.stringify(slotNames)}

GUIDELINES:
1. "title": 4-8 words max, active voice, bold insight (NEVER generic like "Introduction").
2. "kicker": 2-3 words uppercase category badge (e.g. "MATHEMATICAL PROOF", "MARKET SIZE", "ARCHITECTURE").
3. "subtitle": One crisp sentence clarifying the title's thesis.
4. "body": Concise narrative paragraph, max 2-3 sentences.
5. "items": 3-5 punchy bullet points, starting with action verbs.
6. "cards": If layout has cards, provide 3 distinct conceptual pillars with title, body (15 words max), and an icon keyword (e.g. "cpu", "database", "shield", "sparkles", "trending-up", "layers", "workflow").
7. "stats": If stat layout, provide big memorable numbers (e.g. "12x", "99.8%", "$4.2B", "0 Error") with 3-word labels and supporting context.
8. "diagram": If visualizing a system, process, or proof, describe a custom diagram:
   {
     "type": "process_flow" | "architecture_layers" | "quadrant_matrix" | "cyclical_loop",
     "title": "Diagram Title",
     "nodes": [
       { "id": "1", "title": "Step/Node Name", "description": "Concise detail", "badge": "Step 01", "icon": "zap" }
     ]
   }
9. "speakerNotes": 2-3 sentences of what the presenter should say out loud.

LANGUAGE RULE:
Produce the content in ${language} (if Hinglish, use natural Hindi + English mix).

OUTPUT FORMAT:
Return a JSON object containing keys for the required slots and "speakerNotes".`;

    const userPrompt = `TOPIC: "${topic}"
AUDIENCE: ${audience}
SLIDE OBJECTIVE: "${objective}"

Generate the complete JSON payload for this slide.`;

    try {
      const response = await AIClient.complete("SlideWriter", [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], { temperature: 0.7 });

      const cleaned = response.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const slotContent: Record<string, SlotContent> = {};
      let extraShapes: Shape[] | undefined;

      // Map AI output to layout slots
      for (const [name, slot] of Object.entries(layout.slots)) {
        if (slot.kind === "text") {
          let text = parsed[name] || parsed.title || objective;
          if (name === "kicker") text = parsed.kicker || "KEY INSIGHT";
          if (name === "caption") text = parsed.caption || `Source: ${topic} Research`;
          if (name === "action") text = parsed.action || "Explore Next Steps →";

          // Card title/body mappings
          if (name.startsWith("card") && name.endsWith("_title")) {
            const idx = parseInt(name.charAt(4), 10) - 1;
            text = parsed.cards?.[idx]?.title || `Pillar ${idx + 1}`;
          } else if (name.startsWith("card") && name.endsWith("_body")) {
            const idx = parseInt(name.charAt(4), 10) - 1;
            text = parsed.cards?.[idx]?.body || `Core mechanism supporting ${topic}.`;
          }

          // Grid item mappings
          if (name.startsWith("item") && name.endsWith("_title")) {
            const idx = parseInt(name.charAt(4), 10) - 1;
            text = parsed.gridItems?.[idx]?.title || parsed.items?.[idx] || `Feature ${idx + 1}`;
          } else if (name.startsWith("item") && name.endsWith("_desc")) {
            const idx = parseInt(name.charAt(4), 10) - 1;
            text = parsed.gridItems?.[idx]?.desc || `High-impact technical capability.`;
          }

          slotContent[name] = { kind: "text", text };
        } else if (slot.kind === "list") {
          const rawItems = parsed[name] || parsed.items || [objective];
          const items = Array.isArray(rawItems) ? rawItems : [String(rawItems)];
          slotContent[name] = { kind: "list", items };
        } else if (slot.kind === "image") {
          // Trigger Dual Visual Generator (Wikimedia Photo or Gemini Vector SVG)
          const imgPrompt = parsed.imagePrompt || `${parsed.title || topic}, editorial presentation graphic`;
          const aiImg = await generateAIImage({
            prompt: imgPrompt,
            topic,
            seed: request.slideIndex * 37 + 101,
          });

          slotContent[name] = {
            kind: "image",
            src: aiImg.src,
            alt: parsed.title || topic,
          };
        } else if (slot.kind === "icon") {
          let iconName = "sparkles";
          if (name.startsWith("card")) {
            const idx = parseInt(name.charAt(4), 10) - 1;
            iconName = parsed.cards?.[idx]?.icon || "sparkles";
          } else if (name.startsWith("item")) {
            const idx = parseInt(name.charAt(4), 10) - 1;
            iconName = parsed.gridItems?.[idx]?.icon || "sparkles";
          }
          slotContent[name] = { kind: "icon", iconName };
        } else if (slot.kind === "bigNumber") {
          const statData = parsed[name] || parsed.bigNumber || {
            number: "10x",
            label: "Performance Leap",
            supporting: "Verified across benchmarks",
          };
          slotContent[name] = {
            kind: "bigNumber",
            number: statData.number || "99%",
            label: statData.label || "Efficiency Gain",
            supporting: statData.supporting,
          };
        }
      }

      // If AI generated a dynamic diagram specification, build its native vector shapes
      if (parsed.diagram && parsed.diagram.nodes?.length > 0) {
        const diagramSpec = parsed.diagram as AIDiagramSpec;
        // Allocate right half or central bounds for the diagram
        const diagramBounds = { x: 6.8, y: 1.6, w: 5.8, h: 5.2 };
        extraShapes = buildDynamicDiagramShapes(diagramSpec, diagramBounds, ds, slideIndex);
      }

      return {
        slotContent,
        extraShapes,
        speakerNotes: parsed.speakerNotes || `Explain the core implications of ${parsed.title || topic} for the audience.`,
      };
    } catch (err) {
      console.warn(`[SlideWriterAgent] Fallback for slide ${slideIndex}:`, err);
      // Fallback content mapping
      const fallbackSlots: Record<string, SlotContent> = {};
      for (const [name, slot] of Object.entries(layout.slots)) {
        if (slot.kind === "text") {
          fallbackSlots[name] = { kind: "text", text: name === "title" ? topic : objective };
        } else if (slot.kind === "list") {
          fallbackSlots[name] = { kind: "list", items: [objective, "Detailed execution methodology", "Key metric validation"] };
        } else if (slot.kind === "image") {
          fallbackSlots[name] = { kind: "image", src: "fixture://placeholder.svg", alt: topic };
        } else if (slot.kind === "icon") {
          fallbackSlots[name] = { kind: "icon", iconName: "star" };
        } else if (slot.kind === "bigNumber") {
          fallbackSlots[name] = { kind: "bigNumber", number: "10x", label: "Advancement" };
        }
      }

      return {
        slotContent: fallbackSlots,
        speakerNotes: `Presenter note for ${topic}.`,
      };
    }
  }
}

