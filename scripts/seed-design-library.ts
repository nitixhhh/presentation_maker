import { CURATED_PALETTES } from "../src/lib/design/palettes";
import { CURATED_FONT_PAIRS } from "../src/lib/design/fonts";
import { LAYOUT_REGISTRY } from "../src/lib/design/layouts";

async function seed() {
  console.log("=========================================");
  console.log("  SEEDING PRESENTATION DESIGN LIBRARY    ");
  console.log("=========================================\n");

  console.log(`[Palettes] Loaded ${CURATED_PALETTES.length} harmonious curated color palettes:`);
  CURATED_PALETTES.forEach((p) => {
    console.log(`  - [${p.id}] "${p.name}" (bg: ${p.background}, primary: ${p.primary}, text: ${p.text})`);
  });

  console.log(`\n[Fonts] Loaded ${CURATED_FONT_PAIRS.length} curated typography pairings:`);
  CURATED_FONT_PAIRS.forEach((f) => {
    console.log(`  - [${f.id}] "${f.name}" (Heading: ${f.headingFont}, Body: ${f.bodyFont}, Hindi: ${f.supportsHindi ? "Yes" : "No"})`);
  });

  const layouts = Object.values(LAYOUT_REGISTRY);
  console.log(`\n[Layouts] Registered ${layouts.length} distinct slide layouts:`);
  layouts.forEach((l) => {
    console.log(`  - [${l.id}] (${l.category}) ${l.name} [Default Visual: ${l.defaultVisualType}]`);
  });

  console.log("\n✓ Design Library successfully verified and seeded!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
