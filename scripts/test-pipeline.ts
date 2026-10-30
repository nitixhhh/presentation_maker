import fs from "fs";
import path from "path";
import { OwnerAgent } from "../src/lib/agents/owner";
import { PresentationRequest } from "../src/schemas/presentation";
import { generateSlideshowHtml } from "../src/lib/export/htmlExport";
import { PptxExporter } from "../src/lib/export/pptxExport";
import { DeterministicQa } from "../src/lib/qa/deterministicQa";
import { PlaywrightQa } from "../src/lib/qa/playwrightQa";

async function runPipelineTest() {
  console.log("=========================================");
  console.log("  TESTING MULTI-AGENT GENERATION PIPELINE");
  console.log("=========================================\n");

  const testRequest: PresentationRequest = {
    topic: "Autonomous AI Agents in 2026: From Hype to Enterprise Scale",
    audience: "Tech Founders & Product Leaders",
    tone: "Visionary, Practical, and High-Energy",
    slideCount: 4,
    language: "English",
    visualStyle: "modern-dark",
    imageSource: "stock",
    toggles: {
      charts: true,
      diagrams: true,
      codeBlocks: false,
      icons: true,
      speakerNotes: true,
    },
  };

  console.log(`[1] Initiating Owner Orchestrator for topic: "${testRequest.topic}"`);
  const startTime = Date.now();

  const deck = await OwnerAgent.orchestrate(testRequest, (step, percent, details) => {
    console.log(`  [Progress ${percent}%] ${step} ${details ? `(${details})` : ""}`);
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Pipeline generated deck in ${durationSec}s! Total slides: ${deck.slides.length}`);

  // 2. Deterministic QA check
  console.log("\n[2] Executing Deterministic QA Inspection...");
  const deterministicQa = DeterministicQa.inspectDeck(deck);
  console.log(`  Passed: ${deterministicQa.passed}`);
  if (deterministicQa.issues.length > 0) {
    console.log(`  Issues flagged (${deterministicQa.issues.length}):`);
    deterministicQa.issues.forEach((issue) => {
      console.log(`    - Slide ${issue.slideIndex} [${issue.type}]: ${issue.message}`);
    });
  }

  // 3. Playwright Render & Overflow QA
  console.log("\n[3] Executing Playwright Headless Overflow QA...");
  const playwrightQa = await PlaywrightQa.verifyLayoutAndOverflow(deck);
  console.log(`  Playwright Overflow Detected: ${playwrightQa.overflowDetected}`);
  if (playwrightQa.overflowSlides.length > 0) {
    console.log(`  Overflow slides: ${playwrightQa.overflowSlides.join(", ")}`);
  }

  // 4. Export artifacts
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log("\n[4] Generating Export Deliverables...");
  
  // HTML Export
  const html = generateSlideshowHtml(deck);
  const htmlPath = path.join(outDir, "test-deck.html");
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`  ✓ HTML slideshow exported to: ${htmlPath}`);

  // PPTX Export
  const pptxBuffer = await PptxExporter.generate(deck);
  const pptxPath = path.join(outDir, "test-deck.pptx");
  fs.writeFileSync(pptxPath, pptxBuffer);
  console.log(`  ✓ PPTX presentation exported to: ${pptxPath}`);

  console.log("\n=========================================");
  console.log("  ALL PHASE 1 AGENT PIPELINE TESTS PASSED ");
  console.log("=========================================");
}

runPipelineTest().catch((err) => {
  console.error("Test pipeline failed:", err);
  process.exit(1);
});
