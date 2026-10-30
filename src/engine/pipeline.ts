/**
 * Engine v2 — V2-0 Pipeline Orchestrator
 *
 * Deterministic pipeline (no LLM):
 *   Seed → DesignSystem → LayoutPlan → ShapeBuild → SceneGraph → QA → Emit
 *
 * In V2-0 we feed fixture content. V2-1 replaces fixtures with Director + SlideWriter.
 */

import { generateDesignSystem, mulberry32 } from "./designSystem/generator";
import type { Mood } from "./designSystem/generator";
import { planLayoutSequence, getLayout } from "./layouts/registry";
import { checkSceneGraph } from "./qa/sceneGraphChecks";
import type { QAResult } from "./qa/sceneGraphChecks";
import { emitHtml } from "./emitters/html";
import { emitPptx } from "./emitters/pptx";
import type {
  SceneGraph,
  SceneGraphSlide,
  Shape,
  Fill,
  DesignSystemTokens,
} from "./sceneGraph";
import type {
  SlotContent,
  LayoutDefinition,
  Slot,
} from "./layouts/types";
import type { FixtureTopic, FixtureSlideContent } from "./fixtures/topics";
import { DirectorAgent, type DirectorRequest } from "./agents/director";
import { SlideWriterAgent } from "./agents/slideWriter";

// ─── Pipeline Output ────────────────────────────────────

export interface PipelineOutput {
  sceneGraph: SceneGraph;
  qaResult: QAResult;
  htmlContent: string;
  pptxBuffer: Buffer;
  /** PDF is optional — requires Playwright browser */
  pdfBuffer?: Buffer;
}

// ─── Content ↔ Slot Mapping ─────────────────────────────

/**
 * Maps flat fixture slide content to the slot-keyed Record<string, SlotContent>
 * that a layout's buildShapes() expects.
 *
 * The mapping is driven by the layout's actual slot definitions:
 *  - It looks at each slot's name & kind
 *  - It pulls the corresponding data from the fixture content bag
 */
function mapContentToSlots(
  layout: LayoutDefinition,
  content: FixtureSlideContent
): Record<string, SlotContent> {
  const result: Record<string, SlotContent> = {};
  const slots = layout.slots;

  for (const [name, slot] of Object.entries(slots) as [string, Slot][]) {
    switch (slot.kind) {
      // ── Text slots ──
      case "text": {
        let text = "";
        if (name === "title") text = content.title;
        else if (name === "subtitle") text = content.subtitle ?? "";
        else if (name === "kicker") text = content.kicker ?? "";
        else if (name === "body") text = content.body ?? "";
        else if (name === "caption") text = content.caption ?? "";
        else if (name === "action") text = content.action ?? "Get Started →";
        // card*_title / card*_body
        else if (name.startsWith("card") && name.endsWith("_title")) {
          const idx = parseInt(name.charAt(4), 10) - 1;
          text = content.cards?.[idx]?.title ?? "";
        } else if (name.startsWith("card") && name.endsWith("_body")) {
          const idx = parseInt(name.charAt(4), 10) - 1;
          text = content.cards?.[idx]?.body ?? "";
        }
        // item*_title / item*_desc
        else if (name.startsWith("item") && name.endsWith("_title")) {
          const idx = parseInt(name.charAt(4), 10) - 1;
          text = content.gridItems?.[idx]?.title ?? "";
        } else if (name.startsWith("item") && name.endsWith("_desc")) {
          const idx = parseInt(name.charAt(4), 10) - 1;
          text = content.gridItems?.[idx]?.desc ?? "";
        }
        result[name] = { kind: "text", text };
        break;
      }

      // ── List slots ──
      case "list": {
        const items =
          content.bodyItems && content.bodyItems.length > 0
            ? content.bodyItems
            : content.body
            ? content.body.split(". ").filter(Boolean)
            : ["No content provided"];
        result[name] = { kind: "list", items };
        break;
      }

      // ── Image slots ──
      case "image": {
        result[name] = {
          kind: "image",
          src: "fixture://placeholder.svg",
          alt: content.imageAlt ?? content.title,
        };
        break;
      }

      // ── Icon slots ──
      case "icon": {
        let iconName = "star";
        if (name.startsWith("card")) {
          const idx = parseInt(name.charAt(4), 10) - 1;
          iconName = content.cards?.[idx]?.icon ?? "star";
        } else if (name.startsWith("item")) {
          const idx = parseInt(name.charAt(4), 10) - 1;
          iconName = content.gridItems?.[idx]?.icon ?? "star";
        }
        result[name] = { kind: "icon", iconName };
        break;
      }

      // ── BigNumber slots ──
      case "bigNumber": {
        if (name === "bigNumber") {
          const bn = content.bigNumber ?? {
            number: "0",
            label: "N/A",
          };
          result[name] = { kind: "bigNumber", ...bn };
        } else if (name === "stat1") {
          const s = content.stat1 ?? { number: "0", label: "Stat 1" };
          result[name] = { kind: "bigNumber", ...s };
        } else if (name === "stat2") {
          const s = content.stat2 ?? { number: "0", label: "Stat 2" };
          result[name] = { kind: "bigNumber", ...s };
        } else if (name === "stat3") {
          const s = content.stat3 ?? { number: "0", label: "Stat 3" };
          result[name] = { kind: "bigNumber", ...s };
        }
        break;
      }

      // ── Chart slots ──
      case "chart": {
        result[name] = {
          kind: "chart",
          chartPng: "fixture://chart-placeholder.png",
          title: content.title,
        };
        break;
      }

      // ── Diagram slots ──
      case "diagram": {
        result[name] = {
          kind: "diagram",
          data: {},
          mermaidSyntax: "graph LR\n  A[Start] --> B[Process] --> C[End]",
        };
        break;
      }
    }
  }

  return result;
}

// ─── Background Fill Rotation ───────────────────────────

function backgroundForSlide(
  ds: DesignSystemTokens,
  slideIndex: number,
  totalSlides: number
): Fill {
  const palette = ds.palette;
  // Rotate bg colours: bg → bgAlt → surface → bg → ...
  const bgCycle = [palette.bg, palette.bgAlt, palette.surface];
  const base = bgCycle[slideIndex % bgCycle.length];

  // First and last slides use primary-tinted background for punch
  if (slideIndex === 0) {
    return {
      kind: "gradient",
      type: "linear",
      angle: 135,
      stops: [
        { color: palette.primary, pos: 0 },
        { color: palette.bg, pos: 100 },
      ],
    };
  }
  if (slideIndex === totalSlides - 1) {
    return {
      kind: "gradient",
      type: "linear",
      angle: 180,
      stops: [
        { color: palette.bg, pos: 0 },
        { color: palette.primary, pos: 100 },
      ],
    };
  }

  return { kind: "solid", color: base };
}

// ─── Main Pipeline ──────────────────────────────────────

export interface PipelineOptions {
  seed: number;
  /** Skip PDF generation (requires Playwright browser) */
  skipPdf?: boolean;
  /** PPTX mode */
  pptxMode?: "editable" | "exact";
}

export async function runPipeline(
  topic: FixtureTopic,
  options: PipelineOptions
): Promise<PipelineOutput> {
  const { seed, skipPdf = false, pptxMode = "editable" } = options;

  console.log(
    `[Pipeline] Starting V2-0 for "${topic.title}" (seed=${seed}, mood=${topic.mood})`
  );

  // ── Step 1: Generate Design System ──
  const ds = generateDesignSystem(seed, topic.mood, topic.language);
  console.log(
    `[Pipeline] Design System: family="${ds.styleFamily}", palette bg=${ds.palette.bg}, heading="${ds.fonts.heading}"`
  );

  // ── Step 2: Plan Layout Sequence ──
  const plan = planLayoutSequence(topic.roles, seed);
  console.log(
    `[Pipeline] Layout plan: ${plan.map((p) => p.layoutId).join(" → ")}`
  );

  // ── Step 3: Build Shapes per Slide ──
  const rng = mulberry32(seed + 9999); // separate rng for shape building
  const slides: SceneGraphSlide[] = [];

  for (let i = 0; i < plan.length; i++) {
    const { layoutId, variant } = plan[i];
    const layout = getLayout(layoutId);
    const fixtureContent = topic.slides[i];

    if (!fixtureContent) {
      console.warn(
        `[Pipeline] No fixture content for slide ${i} — using fallback`
      );
      continue;
    }

    // Map fixture content → slot content
    const slotContent = mapContentToSlots(layout, fixtureContent);

    // Build shapes
    let shapes: Shape[];
    try {
      shapes = layout.buildShapes({
        ds,
        slotContent,
        variant,
        rng,
        slideIndex: i,
      });
    } catch (err) {
      console.error(
        `[Pipeline] buildShapes failed for slide ${i} (${layoutId}):`,
        err
      );
      shapes = []; // empty slide rather than crash
    }

    // Add decoration shapes
    try {
      const decoShapes = layout.decorations(ds, rng);
      shapes.push(...decoShapes);
    } catch {
      // Decorations are optional — don't crash
    }

    // Background
    const background = backgroundForSlide(ds, i, plan.length);

    slides.push({
      index: i,
      layoutId,
      layoutVariant: variant,
      background,
      shapes,
      speakerNotes: fixtureContent.speakerNotes,
    });
  }

  // ── Step 4: Assemble Scene Graph ──
  const sg: SceneGraph = {
    deckId: `v2-${topic.slug}-${seed}`,
    topic: topic.title,
    slideCount: slides.length,
    slides,
    designSystem: ds,
  };

  console.log(`[Pipeline] Scene graph assembled: ${sg.slideCount} slides`);

  // ── Step 5: QA Checks ──
  const qaResult = checkSceneGraph(sg);
  const errors = qaResult.issues.filter((i) => i.severity === "error");
  const warnings = qaResult.issues.filter((i) => i.severity === "warning");
  console.log(
    `[Pipeline] QA: ${qaResult.passed ? "PASSED ✓" : "FAILED ✗"} — ${errors.length} errors, ${warnings.length} warnings`
  );

  // ── Step 6: Emit HTML ──
  const htmlContent = emitHtml(sg);
  console.log(`[Pipeline] HTML emitted: ${htmlContent.length} chars`);

  // ── Step 7: Emit PPTX ──
  const pptxBuffer = await emitPptx(sg, pptxMode);
  console.log(
    `[Pipeline] PPTX emitted: ${(pptxBuffer.length / 1024).toFixed(1)} KB`
  );

  // ── Step 8: Emit PDF (optional) ──
  let pdfBuffer: Buffer | undefined;
  if (!skipPdf) {
    try {
      const { emitPdf } = await import("./emitters/pdf");
      pdfBuffer = await emitPdf(htmlContent);
      console.log(
        `[Pipeline] PDF emitted: ${(pdfBuffer.length / 1024).toFixed(1)} KB`
      );
    } catch (err) {
      console.warn("[Pipeline] PDF skipped (Playwright not available):", err);
    }
  }

  console.log(`[Pipeline] ✓ Done for "${topic.title}"`);

  return { sceneGraph: sg, qaResult, htmlContent, pptxBuffer, pdfBuffer };
}

// ─── Live AI Pipeline (Director + SlideWriter + AI Visuals) ─────

export interface AIPipelineOptions {
  seed?: number;
  skipPdf?: boolean;
  pptxMode?: "editable" | "exact";
  onProgress?: (progress: {
    percent: number;
    step: string;
    details: string;
    log?: { agent: string; action: string; timestamp: string };
  }) => void;
}

export async function runAIPipeline(
  request: DirectorRequest,
  options: AIPipelineOptions = {}
): Promise<PipelineOutput> {
  const seed = request.seed || options.seed || Math.floor(Math.random() * 100000);
  const { skipPdf = false, pptxMode = "editable", onProgress } = options;

  const emit = (percent: number, step: string, details: string, agent = "Director") => {
    console.log(`[EngineV2] [${percent}%] [${agent}] ${step} - ${details}`);
    if (onProgress) {
      onProgress({
        percent,
        step,
        details,
        log: {
          agent,
          action: `${step}: ${details}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      });
    }
  };

  emit(10, "Architecting Narrative & Strategy", `Analyzing "${request.topic}" for target audience`, "Director");

  // Step 1: AI Director plans deck structure
  const plan = await DirectorAgent.planDeck({ ...request, seed });
  emit(28, "Narrative Arc Established", `Theme: "${plan.title}" (${plan.slides.length} slides)`, "Director");

  // Step 2: Deterministic Design System
  emit(35, "Generating Bespoke Design DNA", `Selected mood: ${plan.mood}, seed: ${seed}`, "ArtDirector");
  const ds = generateDesignSystem(seed, plan.mood, plan.language);

  // Step 3: SlideWriter writes content and AI visuals
  const slides: SceneGraphSlide[] = [];
  const rng = mulberry32(seed + 8888);

  for (let i = 0; i < plan.slides.length; i++) {
    const planned = plan.slides[i];
    const layout = getLayout(planned.layoutId);
    const progressPct = 40 + Math.round(((i + 1) / plan.slides.length) * 45);

    emit(
      progressPct,
      `Drafting Slide ${i + 1} Visuals & Content`,
      `Layout: ${layout.name} (${planned.objective.slice(0, 45)}...)`,
      "SlideWriter"
    );

    const slideResult = await SlideWriterAgent.writeSlide({
      topic: request.topic,
      audience: request.audience || "General Audience",
      slideIndex: i,
      totalSlides: plan.slides.length,
      layout,
      variant: planned.variant,
      objective: planned.objective,
      visualIntent: planned.visualIntent,
      language: request.language || "English",
      ds,
    });

    let shapes: Shape[] = [];
    try {
      shapes = layout.buildShapes({
        ds,
        slotContent: slideResult.slotContent,
        variant: planned.variant,
        rng,
        slideIndex: i,
      });
    } catch (e) {
      console.warn(`[EngineV2] Layout build error for slide ${i}:`, e);
      shapes = [];
    }

    // Append AI diagram vector shapes if generated
    if (slideResult.extraShapes && slideResult.extraShapes.length > 0) {
      shapes.push(...slideResult.extraShapes);
    }

    // Add layout decorations
    try {
      const deco = layout.decorations(ds, rng);
      shapes.push(...deco);
    } catch {}

    const background = backgroundForSlide(ds, i, plan.slides.length);

    slides.push({
      index: i,
      layoutId: planned.layoutId,
      layoutVariant: planned.variant,
      background,
      shapes,
      speakerNotes: slideResult.speakerNotes,
    });
  }

  // Step 4: Assemble SceneGraph
  emit(88, "Assembling Deck Scene Graph", `Synthesizing ${slides.length} slides with native geometry`, "Engine");
  const sg: SceneGraph = {
    deckId: `v2-${request.topic.slice(0, 15).replace(/[^a-z0-9]/gi, "-")}-${seed}`,
    topic: request.topic,
    slideCount: slides.length,
    slides,
    designSystem: ds,
  };

  // Step 5: QA checks
  emit(92, "Running Deterministic QA Gates", "Verifying safe area, text fits, and color harmony", "QAValidator");
  const qaResult = checkSceneGraph(sg);

  // Step 6: Multi-format Emitters
  emit(95, "Synthesizing PPTX & HTML Slideshow", "Generating native vector shapes and typography", "ExportEngine");
  const htmlContent = emitHtml(sg);
  const pptxBuffer = await emitPptx(sg, pptxMode);

  let pdfBuffer: Buffer | undefined;
  if (!skipPdf) {
    try {
      const { emitPdf } = await import("./emitters/pdf");
      pdfBuffer = await emitPdf(htmlContent);
    } catch (err) {
      console.warn("[EngineV2] PDF skipped:", err);
    }
  }

  emit(100, "Deck Generation Complete", `Successfully crafted ${slides.length} professional slides`, "Director");

  return { sceneGraph: sg, qaResult, htmlContent, pptxBuffer, pdfBuffer };
}


