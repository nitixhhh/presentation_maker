import test from "node:test";
import assert from "node:assert/strict";
import { extractHtml, fillRefs } from "./slide";
import { pictureStyle } from "./images";
import { finalDocument } from "./render";

test("extractHtml takes the fenced block that holds the document, skipping a css-only block", () => {
  const doc = "<!doctype html><html><head><style>body{}</style></head><body>" + "x".repeat(500) + "</body></html>";
  assert.equal(extractHtml("```css\nbody{}\n```\n```html\n" + doc + "\n```"), doc);
  assert.equal(extractHtml("here you go\n" + doc), doc);
});

test("extractHtml rejects a reply cut off mid-body", () => {
  assert.equal(extractHtml("```html\n<!doctype html><html><head></head><body>" + "x".repeat(600)), null);
});

test("fillRefs inserts the real citations where the designer left the marker", () => {
  const out = fillRefs("<div class='list'><!-- REFS --></div>", [{ n: 1, text: "A & B (2020). Title.", url: "" }]);
  assert.match(out, /<div class="ref"><span class="ref-n">1<\/span><span class="ref-text">A &amp; B \(2020\). Title.<\/span><\/div>/);
});

test("pictureStyle drops frames and captions from the image style", () => {
  const s = pictureStyle("Warm sepia plates with candlelight. Presented inside thin ink borders with roman-numeral captions.");
  assert.match(s, /sepia/);
  assert.doesNotMatch(s, /caption|border/i);
});

test("finalDocument strips scripts and font links and injects the canvas guard", () => {
  const d = finalDocument('<html><head><link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet"><script>alert(1)</script></head><body>hi</body></html>', "@font-face{}");
  assert.doesNotMatch(d, /<script|fonts.googleapis/);
  assert.match(d, /v7-guard/);
});
