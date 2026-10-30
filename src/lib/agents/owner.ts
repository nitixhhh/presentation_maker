import { PresentationDeck, PresentationRequest, Slide, VisualElement } from "@/schemas/presentation";
import { ResearcherAgent } from "./researcher";
import { ArtDirectorAgent } from "./artDirector";
import { SlideWriterAgent } from "./slideWriter";
import { DiagramCodeSpecialistAgent } from "./diagramCodeSpecialist";
import { ImagePromptWriterAgent } from "./imagePromptWriter";
import { DeterministicQa } from "@/lib/qa/deterministicQa";
import { PlaywrightQa } from "@/lib/qa/playwrightQa";

export interface AgentActivityLog {
  agent: string;
  action: string;
  provider?: string;
  model?: string;
  outputSnippet?: string;
  timestamp: string;
}

export interface GenerationProgressCallback {
  (step: string, percent: number, details?: string, log?: AgentActivityLog): void;
}

export class OwnerAgent {
  public static async orchestrate(
    request: PresentationRequest,
    onProgress?: GenerationProgressCallback
  ): Promise<PresentationDeck> {
    const report = (step: string, percent: number, details?: string, log?: Partial<AgentActivityLog>) => {
      const now = new Date().toLocaleTimeString();
      const activity: AgentActivityLog = {
        agent: log?.agent || "Owner",
        action: log?.action || step,
        provider: log?.provider,
        model: log?.model,
        outputSnippet: log?.outputSnippet,
        timestamp: now,
      };
      console.log(`[Owner] [${percent}%] [${activity.agent}] ${step} - ${details || ""}`);
      if (onProgress) onProgress(step, percent, details, activity);
    };

    // 1. RESEARCH PHASE
    report(
      "Researching Topic & Market Context",
      15,
      `Analyzing "${request.topic}" for audience: ${request.audience}`,
      {
        agent: "Researcher",
        action: "Conducting structured research & narrative arc synthesis",
        provider: "Google AI Studio",
        model: "gemini-2.5-flash",
      }
    );
    const research = await ResearcherAgent.execute(request);
    report(
      "Research Complete",
      28,
      `Formulated narrative with ${research.keyThemes.length} core themes`,
      {
        agent: "Researcher",
        action: `Executive Summary: "${research.executiveSummary.slice(0, 120)}..."`,
      }
    );

    // 2. DESIGN DNA PHASE
    report(
      "Establishing Design DNA & Visual Language",
      35,
      "Selecting bespoke palette, typography, and layout sequence",
      {
        agent: "ArtDirector",
        action: "Formulating custom color harmony & Google Fonts pairing",
        provider: "Google AI Studio",
        model: "gemini-2.5-flash",
      }
    );
    const artDirection = await ArtDirectorAgent.execute(request, research.executiveSummary);
    report(
      "Design DNA Established",
      48,
      `Theme: "${artDirection.designThemeName}"`,
      {
        agent: "ArtDirector",
        action: `Palette: ${artDirection.palette.name} | Fonts: ${artDirection.fontPair.headingFont} + ${artDirection.fontPair.bodyFont} | Motif: ${artDirection.motif}`,
      }
    );

    // 3. COPYWRITING PHASE
    report(
      "Drafting High-Impact Slide Content",
      55,
      `Writing punchy copy & speaker notes for ${artDirection.layoutSequence.length} slides`,
      {
        agent: "SlideWriter",
        action: "Generating headline conclusions, word-capped bullets, and presenter storytelling cues",
        provider: "Google AI Studio",
        model: "gemini-2.5-flash",
      }
    );
    const writerOutput = await SlideWriterAgent.execute(request, research, artDirection);
    report(
      "Copywriting Finalized",
      70,
      `Drafted ${writerOutput.slides.length} slides for "${writerOutput.deckTitle}"`,
      {
        agent: "SlideWriter",
        action: `Drafted: "${writerOutput.deckTitle}" with complete presenter script`,
      }
    );

    // 4. SPECIALIZED VISUALS ENRICHMENT
    report(
      "Synthesizing Visuals & Data Graphics",
      75,
      "Constructing charts, diagrams, stats, and curated imagery",
      {
        agent: "DiagramCodeSpecialist",
        action: "Generating ECharts, Mermaid architecture, and visual components",
        provider: "GroqCloud",
        model: "openai/gpt-oss-120b",
      }
    );
    const finalizedSlides: Slide[] = [];

    for (let i = 0; i < writerOutput.slides.length; i++) {
      const draft = writerOutput.slides[i];
      const directive = artDirection.slideVisualDirectives.find((d) => d.slideIndex === draft.slideIndex);
      const layout = draft.layoutType;

      let visual: VisualElement = draft.visualElementInitial || { type: "none" };

      if (layout === "chart-visualization") {
        report(
          `Synthesizing Chart (Slide ${i + 1})`,
          75 + Math.floor((i / writerOutput.slides.length) * 12),
          `Generating ECharts graphic for "${draft.title}"`,
          {
            agent: "DiagramCodeSpecialist",
            action: `Creating ECharts configuration matching ${artDirection.palette.name} palette`,
            provider: "GroqCloud",
            model: "openai/gpt-oss-120b",
          }
        );
        visual = await DiagramCodeSpecialistAgent.execute(
          draft.slideIndex,
          layout,
          draft.title,
          draft.bodyPoints,
          artDirection.palette
        );
      } else if (layout === "mermaid-diagram" || layout === "code-walkthrough") {
        report(
          `Synthesizing Diagram (Slide ${i + 1})`,
          75 + Math.floor((i / writerOutput.slides.length) * 12),
          `Generating diagram for "${draft.title}"`,
          {
            agent: "DiagramCodeSpecialist",
            action: "Building clean Mermaid syntax architecture",
            provider: "GroqCloud",
            model: "openai/gpt-oss-120b",
          }
        );
        visual = await DiagramCodeSpecialistAgent.execute(
          draft.slideIndex,
          layout,
          draft.title,
          draft.bodyPoints,
          artDirection.palette
        );
      } else if (directive?.recommendedVisualType === "image" || layout === "hero-title" || layout === "full-bleed-visual") {
        visual = await ImagePromptWriterAgent.execute(
          draft.slideIndex,
          request.topic,
          draft.title,
          request.imageSource
        );
      } else if (visual.type === "none" && draft.bodyPoints.length > 0) {
        visual = {
          type: "cards",
          items: draft.bodyPoints.map((bp) => ({
            title: bp.split(":")[0] || "Key Takeaway",
            description: bp.split(":")[1] || bp,
          })),
        };
      }

      finalizedSlides.push({
        id: `slide-${i + 1}`,
        slideNumber: i + 1,
        layoutType: draft.layoutType,
        title: draft.title,
        subtitle: draft.subtitle,
        bodyPoints: draft.bodyPoints,
        visualElement: visual,
        speakerNotes: draft.speakerNotes,
      });
    }

    // 5. DECK ASSEMBLY
    const deck: PresentationDeck = {
      id: `deck-${Date.now()}`,
      topic: request.topic,
      request,
      designDna: {
        seed: Date.now(),
        palette: artDirection.palette,
        fontPair: artDirection.fontPair,
        visualStyle: artDirection.visualStyle,
        motif: artDirection.motif,
        layoutSequence: artDirection.layoutSequence,
      },
      slides: finalizedSlides,
      createdAt: new Date().toISOString(),
      metadata: {
        themeName: artDirection.designThemeName,
        executiveSummary: research.executiveSummary,
      },
    };

    // 6. DETERMINISTIC & PLAYWRIGHT QA
    report(
      "Running Quality & Layout QA Gates",
      90,
      "Inspecting text overflow, word counts, and WCAG contrast",
      {
        agent: "DeterministicQA",
        action: "Verifying WCAG AA contrast ratio and bullet word limits",
      }
    );
    const qaResults = DeterministicQa.inspectDeck(deck);
    if (!qaResults.passed) {
      console.warn("[Owner] Deterministic QA detected issues:", qaResults.issues);
    }

    report(
      "Headless Browser Verification",
      94,
      "Executing Playwright Chromium viewport render verification",
      {
        agent: "PlaywrightQA",
        action: "Rendering deck in 1920x1080 headless Chromium to detect text overflow",
      }
    );
    const playwrightResult = await PlaywrightQa.verifyLayoutAndOverflow(deck);
    if (playwrightResult.overflowDetected) {
      console.warn("[Owner] Playwright detected text overflow on slides:", playwrightResult.overflowSlides);
    } else {
      report(
        "QA Verified: 0 Overflows",
        98,
        "All slides render perfectly within viewport bounds",
        {
          agent: "PlaywrightQA",
          action: "Verified 100% compliant layout bounds & typography scaling",
        }
      );
    }

    report(
      "Deck Generation Complete",
      100,
      `Successfully generated ${deck.slides.length} slides`,
      {
        agent: "Owner",
        action: `Ready for interactive preview, PPTX, PDF, and HTML export`,
      }
    );
    return deck;
  }
}
