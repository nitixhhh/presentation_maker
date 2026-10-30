/**
 * Engine v2 — V2-0 Test Script
 *
 * Runs the V2-0 pipeline for all 5 fixture topics:
 *  1. Generates SceneGraph + QA + HTML + PPTX for each
 *  2. Saves outputs to output/v2/{topic-slug}/
 *  3. Prints QA summary
 *  4. Verifies two different seeds produce different design signatures
 *
 * Run: npx tsx scripts/test-v2-engine.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { FIXTURE_TOPICS } from "../src/engine/fixtures/topics";
import { runPipeline } from "../src/engine/pipeline";
import type { QAResult } from "../src/engine/qa/sceneGraphChecks";

// ─── Config ─────────────────────────────────────────────

const OUTPUT_BASE = join(process.cwd(), "output", "v2");
const SEED_A = 42;
const SEED_B = 1337;

// ─── Helpers ────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function printQA(slug: string, qa: QAResult) {
  const errors = qa.issues.filter((i) => i.severity === "error");
  const warnings = qa.issues.filter((i) => i.severity === "warning");

  const status = qa.passed ? "✅ PASS" : "❌ FAIL";
  console.log(
    `  ${status} | ${slug} | ${errors.length} errors, ${warnings.length} warnings | ` +
    `${qa.stats.totalSlides} slides, ${qa.stats.uniqueLayouts} unique layouts, ${qa.stats.paletteRolesUsed} palette roles`
  );

  for (const issue of errors) {
    console.log(`    ❌ [slide ${issue.slide}] ${issue.type}: ${issue.message}`);
  }
  for (const issue of warnings.slice(0, 5)) {
    console.log(`    ⚠️  [slide ${issue.slide}] ${issue.type}: ${issue.message}`);
  }
  if (warnings.length > 5) {
    console.log(`    ... and ${warnings.length - 5} more warnings`);
  }
}

function generateContactSheet(slug: string, seed: number, qa: QAResult, layoutIds: string[]): string {
  const lines: string[] = [];
  lines.push(`# Contact Sheet: ${slug} (seed=${seed})`);
  lines.push(`## QA: ${qa.passed ? "PASSED" : "FAILED"}`);
  lines.push(`- Slides: ${qa.stats.totalSlides}`);
  lines.push(`- Unique Layouts: ${qa.stats.uniqueLayouts}`);
  lines.push(`- Palette Roles Used: ${qa.stats.paletteRolesUsed}`);
  lines.push(`- Errors: ${qa.issues.filter((i) => i.severity === "error").length}`);
  lines.push(`- Warnings: ${qa.issues.filter((i) => i.severity === "warning").length}`);
  lines.push("");
  lines.push("## Layout Sequence");
  layoutIds.forEach((id, i) => lines.push(`  Slide ${i}: ${id}`));
  lines.push("");
  lines.push("## Issues");
  for (const issue of qa.issues) {
    lines.push(`  [${issue.severity.toUpperCase()}] Slide ${issue.slide}: ${issue.type} — ${issue.message}`);
  }
  return lines.join("\n");
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║          Engine v2 — V2-0 Test Suite                     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  ensureDir(OUTPUT_BASE);

  const results: Array<{
    slug: string;
    seed: number;
    qa: QAResult;
    designSignature: string;
  }> = [];

  // ── Run all 5 topics with Seed A ──
  console.log(`\n━━━ Run 1: Seed ${SEED_A} ━━━\n`);

  for (const topic of FIXTURE_TOPICS) {
    const dir = join(OUTPUT_BASE, topic.slug);
    ensureDir(dir);

    console.log(`\n▶ Topic: "${topic.title}" (${topic.mood}, ${topic.language})`);

    try {
      const output = await runPipeline(topic, {
        seed: SEED_A,
        skipPdf: true, // Skip PDF for fast testing; Playwright may not have browsers
      });

      // Save outputs
      writeFileSync(join(dir, `seed-${SEED_A}.html`), output.htmlContent, "utf-8");
      writeFileSync(join(dir, `seed-${SEED_A}.pptx`), output.pptxBuffer);

      // Contact sheet
      const layoutIds = output.sceneGraph.slides.map((s) => s.layoutId);
      const sheet = generateContactSheet(topic.slug, SEED_A, output.qaResult, layoutIds);
      writeFileSync(join(dir, `seed-${SEED_A}-contact-sheet.md`), sheet, "utf-8");

      // Design signature for comparison
      const ds = output.sceneGraph.designSystem;
      const sig = `${ds.styleFamily}|${ds.palette.bg}|${ds.palette.primary}|${ds.fonts.heading}`;

      results.push({ slug: topic.slug, seed: SEED_A, qa: output.qaResult, designSignature: sig });

      printQA(topic.slug, output.qaResult);
    } catch (err) {
      console.error(`  ❌ CRASHED: ${topic.slug}`, err);
      results.push({
        slug: topic.slug,
        seed: SEED_A,
        qa: { passed: false, issues: [{ severity: "error", slide: -1, type: "crash", message: String(err) }], stats: { totalSlides: 0, paletteRolesUsed: 0, uniqueLayouts: 0 } },
        designSignature: "CRASHED",
      });
    }
  }

  // ── Run all 5 topics with Seed B (for design signature comparison) ──
  console.log(`\n━━━ Run 2: Seed ${SEED_B} (signature comparison) ━━━\n`);

  for (const topic of FIXTURE_TOPICS) {
    const dir = join(OUTPUT_BASE, topic.slug);

    try {
      const output = await runPipeline(topic, {
        seed: SEED_B,
        skipPdf: true,
      });

      writeFileSync(join(dir, `seed-${SEED_B}.html`), output.htmlContent, "utf-8");
      writeFileSync(join(dir, `seed-${SEED_B}.pptx`), output.pptxBuffer);

      const layoutIds = output.sceneGraph.slides.map((s) => s.layoutId);
      const sheet = generateContactSheet(topic.slug, SEED_B, output.qaResult, layoutIds);
      writeFileSync(join(dir, `seed-${SEED_B}-contact-sheet.md`), sheet, "utf-8");

      const ds = output.sceneGraph.designSystem;
      const sig = `${ds.styleFamily}|${ds.palette.bg}|${ds.palette.primary}|${ds.fonts.heading}`;

      results.push({ slug: topic.slug, seed: SEED_B, qa: output.qaResult, designSignature: sig });

      printQA(topic.slug, output.qaResult);
    } catch (err) {
      console.error(`  ❌ CRASHED: ${topic.slug}`, err);
      results.push({
        slug: topic.slug,
        seed: SEED_B,
        qa: { passed: false, issues: [{ severity: "error", slide: -1, type: "crash", message: String(err) }], stats: { totalSlides: 0, paletteRolesUsed: 0, uniqueLayouts: 0 } },
        designSignature: "CRASHED",
      });
    }
  }

  // ── Summary ──
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                    RESULTS SUMMARY                       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const seedAResults = results.filter((r) => r.seed === SEED_A);
  const seedBResults = results.filter((r) => r.seed === SEED_B);

  const allPassed = results.every((r) => r.qa.passed);
  const totalErrors = results.reduce(
    (sum, r) => sum + r.qa.issues.filter((i) => i.severity === "error").length,
    0
  );
  const totalWarnings = results.reduce(
    (sum, r) => sum + r.qa.issues.filter((i) => i.severity === "warning").length,
    0
  );

  console.log(`Total runs:    ${results.length}`);
  console.log(`All QA passed: ${allPassed ? "✅ YES" : "❌ NO"}`);
  console.log(`Total errors:  ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);

  // ── Seed Comparison: Design Signatures ──
  console.log("\n── Design Signature Comparison (same topic, different seeds) ──\n");
  let signaturesAllDifferent = true;

  for (const topic of FIXTURE_TOPICS) {
    const sigA = seedAResults.find((r) => r.slug === topic.slug)?.designSignature ?? "N/A";
    const sigB = seedBResults.find((r) => r.slug === topic.slug)?.designSignature ?? "N/A";
    const isDifferent = sigA !== sigB && sigA !== "CRASHED" && sigB !== "CRASHED";

    if (!isDifferent) signaturesAllDifferent = false;

    console.log(`  ${topic.slug}:`);
    console.log(`    Seed ${SEED_A}: ${sigA}`);
    console.log(`    Seed ${SEED_B}: ${sigB}`);
    console.log(`    Different: ${isDifferent ? "✅ YES" : "❌ NO"}`);
  }

  console.log(`\nAll signatures different across seeds: ${signaturesAllDifferent ? "✅ YES" : "❌ NO"}`);

  // ── Output file listing ──
  console.log("\n── Output Files ──\n");
  console.log(`  Base: ${OUTPUT_BASE}`);
  for (const topic of FIXTURE_TOPICS) {
    console.log(`  ${topic.slug}/`);
    console.log(`    seed-${SEED_A}.html, seed-${SEED_A}.pptx, seed-${SEED_A}-contact-sheet.md`);
    console.log(`    seed-${SEED_B}.html, seed-${SEED_B}.pptx, seed-${SEED_B}-contact-sheet.md`);
  }

  // ── V2-0 Acceptance Criteria ──
  console.log("\n── V2-0 Acceptance Criteria ──\n");
  console.log(`  [${totalErrors === 0 ? "✅" : "❌"}] 0 shapes outside safe area`);
  console.log(`  [${signaturesAllDifferent ? "✅" : "❌"}] Different seeds → different design signatures`);
  console.log(`  [${allPassed ? "✅" : "❌"}] All QA checks pass`);

  // ── Final verdict ──
  const passed = allPassed && signaturesAllDifferent;
  console.log(`\n${"═".repeat(60)}`);
  console.log(passed ? "  🎉 V2-0 ENGINE TEST: ALL PASSED" : "  ⚠️  V2-0 ENGINE TEST: ISSUES FOUND — review above");
  console.log(`${"═".repeat(60)}\n`);

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});

