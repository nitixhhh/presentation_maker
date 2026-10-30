import { SlideWriterAgent } from "../src/engine/agents/slideWriter";
import { getLayout } from "../src/engine/layouts/registry";
import { generateDesignSystem } from "../src/engine/designSystem/generator";

async function main() {
  console.log("Starting test-slidewriter...");
  const layout = getLayout("cover-fullbleed");
  const ds = generateDesignSystem(42, "editorial", "en");

  const res = await SlideWriterAgent.writeSlide({
    topic: "UV-VIS spectroscopy and its application",
    audience: "University Students",
    slideIndex: 0,
    totalSlides: 5,
    layout,
    variant: 0,
    objective: "Introduce UV-VIS spectroscopy as a powerful analytical tool",
    visualIntent: "Hero image of laboratory spectrophotometer with light beam prism",
    language: "English",
    ds,
  });

  console.log("SlotContent keys:", Object.keys(res.slotContent));
  if (res.slotContent.bgImage) {
    const img = res.slotContent.bgImage as any;
    console.log("bgImage src prefix:", img.src?.slice(0, 80));
  } else {
    console.log("bgImage is missing!");
  }
}

main().catch((err) => {
  console.error("Error in test-slidewriter:", err);
});
