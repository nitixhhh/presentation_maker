/**
 * Engine v4 — one deck through the SAME code path the live server runs for POST /api/v3/jobs (request validation,
 * owner engine choice, job manager → generateDeckV4 → buildExports), with local storage. Then proves the exports:
 * no "{{" in any slide HTML, PPTX slide XML or PDF text, and the filled presenter details present.
 *   npx tsx scripts/v4-job.ts '<json body>' <outDir>
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import sharp from "sharp";
import { parseV3Request } from "../src/server/http";
import { engineFor } from "../src/server/engineChoice";
import { createJob, getJobView, exportPath } from "../src/server/jobs/manager";
import { loadDeck, deckDir } from "../src/engine-v3/store";
import { closeBrowser } from "../src/engine-v3/render/browser";

(async () => {
  const body = JSON.parse(process.argv[2]);
  const out = process.argv[3] || "/tmp/v4job";
  fs.mkdirSync(out, { recursive: true });
  const owner = { id: (process.env.OWNER_USER_IDS || "").split(",")[0] };
  const parsed = parseV3Request(body);
  if (!parsed.ok) throw new Error(parsed.error);
  parsed.value.engine = engineFor(owner, body.engine);
  console.log("engine:", parsed.value.engine, "presenter:", JSON.stringify(parsed.value.presenter));
  const t0 = Date.now();
  const job: any = await createJob(parsed.value, "c:local-v4-test", owner.id);
  let v: any = job;
  let last = "";
  const firstReady: Record<number, number> = {};
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    v = await getJobView(job.id);
    const line = `${v?.status} ${v?.progress?.percent}% ${v?.progress?.step}`;
    if (line !== last) console.log(`${Math.round((Date.now() - t0) / 1000)}s ${line}`);
    last = line;
    for (const s of v?.progress?.live?.slides || []) if ((s.state === "ready" || s.state === "done") && !firstReady[s.n]) firstReady[s.n] = Math.round((Date.now() - t0) / 1000);
    if (v?.status === "done" || v?.status === "failed") break;
  }
  if (v.status !== "done") throw new Error(`job failed: ${v.error}`);
  const deck: any = loadDeck(v.deckId)!;
  const secs = Math.round((Date.now() - t0) / 1000);
  // proofs
  const htmlHits = deck.slides.filter((s: any) => /\{\{/.test(s.html)).map((s: any) => s.n);
  const pptx = fs.readFileSync(exportPath(deck.id, "pptx"));
  fs.copyFileSync(exportPath(deck.id, "pptx"), path.join(out, "deck.pptx"));
  fs.copyFileSync(exportPath(deck.id, "pdf"), path.join(out, "deck.pdf"));
  const JSZip = (await import("jszip")).default;
  const z = await JSZip.loadAsync(pptx);
  let pptxText = "";
  for (const n of Object.keys(z.files)) if (/^ppt\/slides\/slide\d+\.xml$/.test(n)) pptxText += await z.files[n].async("string");
  const pdfText = execFileSync("pdftotext", ["-layout", path.join(out, "deck.pdf"), "-"]).toString();
  fs.writeFileSync(path.join(out, "pdf.txt"), pdfText);
  const filled = Object.values(parsed.value.presenter || {}).filter(Boolean) as string[];
  const proof = {
    htmlPlaceholders: htmlHits,
    pptxPlaceholders: /\{\{/.test(pptxText),
    pdfPlaceholders: /\{\{/.test(pdfText),
    filledInHtml: filled.map((v2) => [v2, deck.slides[0].html.includes(v2.replace(/&/g, "&amp;"))]),
    filledInPdf: filled.map((v2) => [v2, pdfText.replace(/\s+/g, " ").includes(v2)]),
  };
  console.log("PROOF", JSON.stringify(proof));
  // contact sheet from the final previews
  const files = deck.slides.map((s: any) => path.join(deckDir(deck.id), "previews", `slide-${String(s.n).padStart(2, "0")}.jpg`)).filter((f: string) => fs.existsSync(f));
  const cols = 3, tw = 640, th = 360, pad = 10, rows = Math.ceil(files.length / cols);
  const comps = await Promise.all(files.map(async (f: string, i: number) => ({ input: await sharp(f).resize(tw, th).toBuffer(), left: pad + (i % cols) * (tw + pad), top: pad + Math.floor(i / cols) * (th + pad) })));
  await sharp({ create: { width: pad + cols * (tw + pad), height: pad + rows * (th + pad), channels: 3, background: "#9ca3af" } }).composite(comps).jpeg({ quality: 84 }).toFile(path.join(out, "sheet.jpg"));
  for (const f of files) fs.copyFileSync(f, path.join(out, path.basename(f)));
  const calls = deck.calls || [];
  const byRole: Record<string, number> = {};
  for (const c of calls) byRole[c.role] = (byRole[c.role] || 0) + 1;
  const stats = { deckId: deck.id, jobId: job.id, seconds: secs, firstSlideReadyAt: Math.min(...Object.values(firstReady)), readyAt: firstReady, aiCalls: calls.length, failed: calls.filter((c: any) => !c.ok).length, byRole, usage: deck.usage, v4: deck.v4, v5: deck.v5, review: deck.review, references: deck.references.map((r: any) => r.text), proof, log: deck.log.slice(-60).map((l: any) => `${l.agent}: ${l.msg}`) };
  fs.writeFileSync(path.join(out, "stats.json"), JSON.stringify(stats, null, 2));
  console.log(`DONE ${secs}s, ${calls.length} AI calls, deck ${deck.id}`);
  await closeBrowser();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
