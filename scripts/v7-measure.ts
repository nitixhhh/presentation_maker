/** Re-measure saved v7 slides (no AI calls): tsx scripts/v7-measure.ts <deck dir> [floor] */
import fs from "fs";
import path from "path";
import { renderSlide, emptyRegion } from "../src/engine-v7/render";
import { closeBrowser } from "../src/engine-v3/render/browser";
(async () => {
  const dir = process.argv[2];
  const out = path.join(dir, "measure");
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(dir).filter((x) => /^final-\d+\.html$/.test(x)).sort()) {
    const r = await renderSlide(fs.readFileSync(path.join(dir, f), "utf8"), out, f.replace(".html", ""), { floor: process.argv[3] === "floor" });
    const e = await emptyRegion(r.png);
    console.log(`== ${f} graphic ${Math.round((r.report.graphicShare || 0) * 100)}% empty ${Math.round(e.share * 100)}% ${e.box.join(",")} floored ${r.floored?.count || 0}`);
    for (const i of r.report.issues) console.log("   " + i.slice(0, 200));
    console.log("   edge: " + (r.report.edgeTexts || []).join(" | ").slice(0, 200));
  }
  await closeBrowser();
  process.exit(0);
})();
