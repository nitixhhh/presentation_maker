import { z } from "zod";
import { AIClient, ChatMessage } from "./client";
import { ToolExecutor } from "@/lib/tools";

export interface ToolLoopOptions<T> {
  agentName: string;
  systemPrompt: string;
  userPrompt: string;
  outputSchema: z.ZodSchema<T>;
  maxTurns?: number;
  availableTools?: string[];
}

export class ToolLoop {
  public static async run<T>(options: ToolLoopOptions<T>): Promise<T> {
    const maxTurns = options.maxTurns || 5;
    const availableToolsList = (options.availableTools || [
      "web_search",
      "search_stock_images",
      "create_chart",
      "create_diagram",
      "render_code",
      "get_icons",
      "pick_fonts",
      "get_palette",
    ]).join(", ");

    const enhancedSystemPrompt = `${options.systemPrompt}

TOOL INSTRUCTIONS:
You have access to the following tools: [${availableToolsList}].
Many free models do not support native function calling, so you MUST respond ONLY with valid JSON in one of these two formats:

Format 1 (To call a tool):
{
  "action": "call_tool",
  "tool": "<tool_name>",
  "args": { ... }
}

Format 2 (When you have finished your task and have the complete answer):
{
  "action": "final_output",
  "data": { ... your complete structured response conforming to the required schema }
}

CRITICAL RULES:
1. Always return raw JSON only. Never wrap in markdown text explanations.
2. If you do not need to call a tool, return Format 2 directly.
`;

    const messages: ChatMessage[] = [
      { role: "system", content: enhancedSystemPrompt },
      { role: "user", content: options.userPrompt },
    ];

    let turn = 0;
    while (turn < maxTurns) {
      turn++;
      const result = await AIClient.complete(options.agentName, messages, {
        temperature: 0.7,
        maxTokens: 3500,
      });

      let parsed: any;
      try {
        // Clean markdown backticks if model wrapped JSON
        const cleanedText = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanedText);
      } catch (err) {
        // Attempt one repair turn
        messages.push({ role: "assistant", content: result.text });
        messages.push({
          role: "user",
          content: "ERROR: Output was not valid JSON. Please return ONLY a valid JSON object matching either Format 1 (call_tool) or Format 2 (final_output).",
        });
        continue;
      }

      if (parsed.action === "call_tool" && parsed.tool) {
        console.log(`[ToolLoop] ${options.agentName} executing tool: ${parsed.tool}`);
        const toolResult = await ToolExecutor.execute(parsed.tool, parsed.args || {});
        messages.push({ role: "assistant", content: JSON.stringify(parsed) });
        messages.push({
          role: "user",
          content: JSON.stringify({
            action: "tool_result",
            tool: parsed.tool,
            result: toolResult,
          }),
        });
        continue;
      }

      // If model returned Format 2 or raw data matching schema
      const candidateData = parsed.action === "final_output" && parsed.data ? parsed.data : parsed;
      const parseValidation = options.outputSchema.safeParse(candidateData);

      if (parseValidation.success) {
        return parseValidation.data;
      } else {
        console.warn(`[ToolLoop] Schema validation failed for ${options.agentName}:`, parseValidation.error.format());
        messages.push({ role: "assistant", content: JSON.stringify(parsed) });
        messages.push({
          role: "user",
          content: `VALIDATION ERROR: Your output failed schema validation: ${JSON.stringify(
            parseValidation.error.format()
          )}. Fix these fields and return Format 2 with valid data.`,
        });
      }
    }

    throw new Error(`[ToolLoop] Agent ${options.agentName} exceeded max turns (${maxTurns}) without valid output.`);
  }
}
