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
