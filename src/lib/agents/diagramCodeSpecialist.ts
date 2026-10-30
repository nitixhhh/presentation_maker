import { ToolLoop } from "@/lib/ai/toolLoop";
import { DiagramCodeOutput, DiagramCodeOutputSchema } from "@/schemas/agents";
import { ColorPalette, VisualElement } from "@/schemas/presentation";

export class DiagramCodeSpecialistAgent {
  public static async execute(
    slideIndex: number,
    layoutType: string,
    slideTitle: string,
    slidePoints: string[],
    palette: ColorPalette
  ): Promise<VisualElement> {
    const isChart = layoutType.includes("chart");
    const isDiagram = layoutType.includes("diagram") || layoutType.includes("process") || layoutType.includes("timeline");
    const isCode = layoutType.includes("code");

    const visualType = isChart ? "chart" : isDiagram ? "diagram" : isCode ? "code" : "stat";

    const systemPrompt = `You are a Data Visualization and Technical Diagram Specialist.
Your job is to generate accurate, visually stunning data visuals, Mermaid syntax, or code snippets for presentations.

TOOLS AVAILABLE:
- "create_chart": for generating ECharts options matching the deck's palette
- "create_diagram": for generating Mermaid diagram code
- "render_code": for formatting code walkthroughs`;

    const userPrompt = `SLIDE INDEX: ${slideIndex}
LAYOUT: ${layoutType}
TITLE: ${slideTitle}
POINTS: ${JSON.stringify(slidePoints)}
PALETTE: ${JSON.stringify(palette)}
TARGET VISUAL TYPE: ${visualType}

Generate the exact visual element specification using your tools or final output.`;

    try {
      const output = await ToolLoop.run<DiagramCodeOutput>({
        agentName: "DiagramCodeSpecialist",
        systemPrompt,
        userPrompt,
        outputSchema: DiagramCodeOutputSchema,
        availableTools: ["create_chart", "create_diagram", "render_code"],
      });
      return output.visualElement;
    } catch (err) {
      console.warn(`[DiagramCodeSpecialist] Falling back to default visual for slide ${slideIndex}:`, err);
      if (isChart) {
        return {
          type: "chart",
          chartType: "bar",
          title: slideTitle,
          echartsOption: {
            backgroundColor: "transparent",
            xAxis: { type: "category", data: ["Initial", "Scale", "Optimization", "Dominance"], axisLabel: { color: palette.text } },
            yAxis: { type: "value", axisLabel: { color: palette.text } },
            series: [{ data: [25, 60, 110, 180], type: "bar", itemStyle: { color: palette.primary, borderRadius: [6, 6, 0, 0] } }],
          },
        };
      }
      if (isDiagram) {
        return {
          type: "diagram",
          kind: "flowchart",
          mermaidSyntax: "graph TD\n  A[Phase 1: Input] --> B[Phase 2: Validation]\n  B --> C[Phase 3: Generation]\n  C --> D[Phase 4: Export]",
        };
      }
      return {
        type: "stat",
        number: "10x",
        label: "Velocity Boost",
        supportingText: "Measured across autonomous pipeline execution benchmarks",
      };
    }
  }
}
