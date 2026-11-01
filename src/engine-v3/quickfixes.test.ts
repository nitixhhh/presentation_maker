/**
 * Tests for the 1 Nov 2026 quick fixes (no network, no AI): logo placement + guard, image fallback + Cloudflare budget,
 * overflow / URL wrap / contrast / vision-on-every-slide. Run with `npm test`.
 */
import { test as nodeTest, before } from "node:test";
const test = (name: string, fn: () => unknown) => nodeTest(name, { timeout: 15_000 }, fn as any);
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

before(() => {
  process.env.DECKCRAFT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dc-quick-test-"));
});

const slide = (n: number, role: string, kind = "none", extra: any = {}) => ({ n, role, title: `Slide ${n}`, keyMessage: "", points: [], notes: "", visual: { kind, ...extra } });
const logoAsset = (forSlides: number[]) => ({ id: "logo", file: "logo.png", width: 800, height: 800, avgColor: "#a0ada7", mime: "image/png", origin: "upload", title: "Institution logo", description: "the presenter's college/university logo", credit: "", forSlides });

test("logo: attached only to the title and closing slides (slide 1 if no title role)", async () => {
  const { logoSlides } = await import("./assets/logo");
  assert.deepEqual(logoSlides([slide(1, "title"), slide(2, "content"), slide(3, "content"), slide(4, "closing"), slide(5, "references")] as any), [1, 4]);
  assert.deepEqual(logoSlides([slide(1, "content"), slide(2, "content")] as any), [1]);
});

test("logo: engine adds one small corner logo on the other slides, never twice, none on the title slide", async () => {
  const { slideDocument } = await import("./render/document");
  const deck: any = { assets: [logoAsset([1, 6])] };
  const design: any = { fontLink: "", css: "" };
  const content = slideDocument(design, "<h1>Hi</h1>", { assetBase: "../assets/", deck, n: 3 });
  assert.equal((content.match(/data-v3-engine="logo"/g) || []).length, 1);
  assert.match(content, /max-width:132px;max-height:40px/);
  assert.match(content, /right:24px;bottom:18px/);
  // a serialised slide that still carries the engine logo does not get a second one
  const again = slideDocument(design, content.slice(content.indexOf("<h1>"), content.indexOf("</section>")), { assetBase: "../assets/", deck, n: 3 });
  assert.equal((again.match(/data-v3-engine="logo"/g) || []).length, 1);
  assert.doesNotMatch(slideDocument(design, "<h1>Hi</h1>", { assetBase: "../assets/", deck, n: 1 }), /data-v3-engine/);
  assert.doesNotMatch(slideDocument(design, "<h1>Hi</h1>", { assetBase: "../assets/", deck, n: 6 }), /data-v3-engine/);
  // decks made before the fix (logo on every slide) render exactly as before
  assert.doesNotMatch(slideDocument(design, "<h1>Hi</h1>", { assetBase: "../assets/", deck: { assets: [logoAsset([1, 2, 3])] } as any, n: 3 }), /data-v3-engine/);
});

test("logo: designer prompt never calls the logo the visual anchor; no-photo branch is restored", async () => {
  const { designerUserPrompt } = await import("./agents/designer");
  const deck: any = {
    brief: { title: "Sim", titleSlideFields: [], language: "English" },
    outline: { slides: [slide(1, "title", "photo"), slide(2, "content", "photo"), slide(3, "content", "generated")] },
    assets: [logoAsset([1])],
    references: [],
    research: { facts: [], sources: [] },
  };
  const p1 = designerUserPrompt(deck, deck.outline.slides[0], new Map());
  assert.match(p1, /No photo for this slide/);
  assert.match(p1, /LOGO: asset:logo is the institution logo/);
  assert.doesNotMatch(p1, /creatively as the slide's visual anchor/);
  const p2 = designerUserPrompt(deck, deck.outline.slides[1], new Map());
  assert.match(p2, /No photo for this slide/);
  assert.match(p2, /engine adds the institution logo small in the bottom-right corner/);
  assert.doesNotMatch(p2, /asset:logo —/);
  // with a real photo the anchor line is back, and it speaks of photos
  deck.assets.push({ id: "img3", file: "img3.jpg", width: 1600, height: 900, avgColor: "#333333", mime: "image/jpeg", origin: "wikimedia", title: "x", description: "a photo", credit: "c", forSlides: [3] });
  assert.match(designerUserPrompt(deck, deck.outline.slides[2], new Map()), /Use the photo\(s\) below creatively as the slide's visual anchor/);
});

test("logo: hard guard script exists and is wired before measuring", async () => {
  const { LOGO_GUARD_JS, LOGO_MAX } = await import("./qa/logoGuard");
  assert.match(LOGO_GUARD_JS, /background-image/);
  assert.ok(LOGO_MAX.w <= 240 && LOGO_MAX.h <= 160);
  const src = fs.readFileSync(path.join(__dirname, "qa/inspect.ts"), "utf8");
  assert.ok(src.indexOf("LOGO_GUARD_JS") < src.indexOf("let m: Measure = await page.evaluate(MEASURE_JS)"));
});

test("overflow: text past its panel is a layout problem the engine fixes; long URLs are wrapped before measuring", async () => {
  const { LAYOUT_TYPES } = await import("./qa/inspect");
  assert.ok(LAYOUT_TYPES.has("text-past-panel"));
  const dom = await import("./render/domScripts");
  assert.match(dom.MEASURE_JS, /type:'text-past-panel', severity:'high'/);
  assert.match(dom.WRAP_JS, /overflow-wrap:anywhere/);
  assert.doesNotMatch(dom.WRAP_JS, /break-all/); // ordinary words never break mid-word
  const src = fs.readFileSync(path.join(__dirname, "qa/inspect.ts"), "utf8");
  assert.ok(src.indexOf("WRAP_JS);") < src.indexOf("let m: Measure = await page.evaluate(MEASURE_JS)"));
  assert.match(src, /"text-past-panel"\) && i\.id/);
  // the regex the page script uses: URLs/DOIs/very long tokens yes, normal words no
  const re = /(https?:\/\/[^\s<>"]{6,}|www\.[^\s<>"]{6,}|doi:\s?[^\s<>"]{6,}|\b10\.\d{4,9}\/[^\s<>"]{4,}|[^\s<>"]{30,})/g;
  assert.ok(dom.WRAP_JS.includes(re.source));
  const hits = (s: string) => (s.match(re) || []).filter((x) => x.length >= 20);
  assert.deepEqual(hits("from https://en.wikipedia.org/wiki/Simulation_hypothesis today"), ["https://en.wikipedia.org/wiki/Simulation_hypothesis"]);
  assert.deepEqual(hits("doi:10.1111/1467-9213.00309"), ["doi:10.1111/1467-9213.00309"]);
  assert.deepEqual(hits("Electroencephalography and state-of-the-art computational neuroscience"), []);
});

test("QA: every slide (references too) gets a vision review on its first render; contrast autofix runs after the AI rounds", async () => {
  const src = fs.readFileSync(path.join(__dirname, "pipeline.ts"), "utf8");
  assert.match(src, /visionMode === "smart" && \(round === 0 \|\| high \+ med > 0\)/);
  assert.doesNotMatch(src, /wantVision && !isRefs/);
  assert.match(src, /fixContrast: true/);
  // all existing passes are still there: AI revisions, fresh redesign, layout enforcement, references safety net
  for (const s of ["reviseSlide(", "fresh redesign", "enforce: true", "references slide: used the exact reference list"]) assert.ok(src.includes(s), s);
  const dom = await import("./render/domScripts");
  assert.match(dom.CONTRAST_FIX_JS, /box-shadow/);
});

test("images: daily Cloudflare budget persists, stops at the limit and after a 'daily allowance used' answer", async () => {
  process.env.DECKCRAFT_STORAGE = "local";
  const b = await import("./assets/imageBudget");
  b.resetBudgetForTests();
  process.env.CF_IMAGE_DAILY_LIMIT = "2";
  assert.equal((await b.canGenerate()).ok, true);
  await b.recordGeneration("ok");
  await b.recordGeneration("ok");
  const gate = await b.canGenerate();
  assert.equal(gate.ok, false);
  assert.match(gate.reason!, /budget reached \(2\/2/);
  // survives a restart (read back from storage)
  b.resetBudgetForTests();
  assert.equal((await b.loadBudget()).used, 2);
  process.env.CF_IMAGE_DAILY_LIMIT = "90";
  assert.equal((await b.canGenerate()).ok, true);
  await b.recordGeneration("quota");
  b.resetBudgetForTests();
  assert.match((await b.canGenerate()).reason!, /allowance is used up/);
  process.env.CF_IMAGE_DAILY_LIMIT = "0";
  assert.match((await b.canGenerate()).reason!, /switched off/);
  delete process.env.CF_IMAGE_DAILY_LIMIT;
  assert.ok(b.isDailyQuotaError(429, '{"errors":[{"message":"AiError: you have used up your daily free allocation of 10,000 neurons"}]}'));
  assert.ok(!b.isDailyQuotaError(500, "neurons"));
  // a new UTC day starts from zero
  const fs2 = await import("node:fs");
  const metaDir = path.join(process.env.DECKCRAFT_DATA_DIR!, "meta");
  assert.ok(fs2.readdirSync(metaDir).some((f) => f.startsWith(`cf-images-${b.utcDay()}`)));
});

test("images: dropped photo slots are restored; references/agenda never get one", async () => {
  const { restoreDroppedSlots } = await import("./agents/imageDirector");
  const slides: any[] = [slide(1, "title", "photo"), slide(2, "content", "diagram"), slide(3, "content", "chart"), slide(4, "content", "generated"), slide(5, "content", "photo", { query: "VR headset" }), slide(6, "references", "photo")];
  const items: any[] = [{ n: 1, source: "ai", subject: "x" }, { n: 4, source: "ai", subject: "y" }];
  assert.deepEqual(restoreDroppedSlots(slides, items), [5]);
  assert.deepEqual(items.find((x) => x.n === 5), { n: 5, source: "real", query: "VR headset", subject: "Slide 5", authentic: false, why: "restored: the outline asked for an image here" });
  assert.ok(!items.some((x) => x.n === 6));
});

test("images: when the AI image fails (Cloudflare 429), the slot gets a real attributed photo; no second Cloudflare call", async () => {
  process.env.DECKCRAFT_STORAGE = "local";
  process.env.CLOUDFLARE_API_TOKEN = "test-token-0123456789";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc123";
  for (const k of ["GOOGLE_AI_API_KEY", "GROQ_API_KEY", "NVIDIA_NIM_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY", "ZAI_API_KEY", "SAMBANOVA_API_KEY"]) delete process.env[k];
  const b = await import("./assets/imageBudget");
  fs.rmSync(path.join(process.env.DECKCRAFT_DATA_DIR!, "meta"), { recursive: true, force: true }); // a fresh day
  b.resetBudgetForTests();
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp({ create: { width: 1400, height: 900, channels: 3, background: { r: 30, g: 90, b: 160 } } }).jpeg({ quality: 95 }).toBuffer();
  const big = Buffer.concat([jpeg]);
  let cf = 0;
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = String(input?.url || input);
    if (url.includes("api.cloudflare.com")) {
      cf++;
      return new Response('{"errors":[{"message":"AiError: AiError: you have used up your daily free allocation of 10,000 neurons"}]}', { status: 429 });
    }
    if (url.includes("commons.wikimedia.org/w/api.php") && url.includes("generator=search"))
      return Response.json({ query: { pages: Object.fromEntries([1, 2].map((i) => [String(i), { index: i, title: `File:Virtual reality headset user ${i}.jpg`, imageinfo: [{ mime: "image/jpeg", width: 2000, height: 1300, thumburl: `https://upload.wikimedia.org/thumb/vr${i}.jpg`, thumbwidth: 1280, thumbheight: 832, descriptionurl: `https://commons.wikimedia.org/wiki/File:VR${i}.jpg`, extmetadata: { Artist: { value: "Jane Doe" }, LicenseShortName: { value: "CC BY-SA 4.0" }, ImageDescription: { value: "A person using a VR headset" } } }] }])) } });
    if (url.includes("upload.wikimedia.org")) return new Response(big, { status: 200, headers: { "content-type": "image/jpeg" } });
    return Response.json({});
  }) as any;
  try {
    const { sourceImages } = await import("./assets/images");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-img-"));
    const logs: string[] = [];
    const slides: any[] = [slide(1, "title", "generated"), slide(4, "content", "generated")];
    const assets = await sourceImages(slides, dir, { mode: "real-first", topic: "Are we living in a simulation", plan: { style: "flat vector", items: [{ n: 1, source: "ai", subject: "a person wearing a VR headset in a dark room" }, { n: 4, source: "ai", subject: "glowing code rain over a city" }] } }, (m) => logs.push(m));
    assert.ok(cf <= 2, `the two AI slots ask in parallel at most once each (${cf})`);
    const { generateImage } = await import("./assets/images");
    const before = cf;
    assert.equal(await generateImage("anything"), null);
    assert.equal(cf, before, "after the daily-allowance answer Cloudflare is not asked again today");
    assert.equal(assets.length, 2);
    assert.notEqual(assets[0].sourceUrl, assets[1].sourceUrl, "never the same photo on two slides");
    for (const a of assets) {
      assert.equal(a.origin, "wikimedia");
      assert.match(a.credit || "", /Jane Doe, CC BY-SA 4\.0, via Wikimedia Commons/);
      assert.ok(fs.existsSync(path.join(dir, a.file)));
    }
    assert.ok(logs.some((l) => /real photos instead|searching real photos/.test(l)), logs.join("\n"));
  } finally {
    globalThis.fetch = real;
  }
});

test("images: photo query from an AI subject sentence", async () => {
  const { photoQueryFromSubject } = await import("./assets/images");
  assert.equal(photoQueryFromSubject("a person wearing a VR headset in a dark room", "x"), "person wearing VR headset dark");
  assert.equal(photoQueryFromSubject("", "Challenges"), "Challenges");
});
