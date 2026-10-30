/**
 * Engine v2 — PDF Emitter
 * Renders HTML slideshow via Playwright headless Chromium → PDF.
 */

import { chromium } from "playwright";

/**
 * Render an HTML slideshow string to a landscape PDF buffer.
 * Each slide becomes one PDF page at 13.333 × 7.5 inches.
 */
export async function emitPdf(htmlContent: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  // Count slides
  const slideCount = await page.evaluate(() => document.querySelectorAll(".slide").length);

  const pages: Buffer[] = [];

  for (let i = 0; i < slideCount; i++) {
    // Show only the current slide
    await page.evaluate((idx: number) => {
      document.querySelectorAll(".slide").forEach((s, j) => {
        (s as HTMLElement).style.display = j === idx ? "block" : "none";
      });
      // Hide nav hint and notes
      const hint = document.getElementById("nav-hint");
      if (hint) hint.style.display = "none";
      const notes = document.getElementById("notes-panel");
      if (notes) notes.style.display = "none";
    }, i);

    await page.waitForTimeout(200); // Allow render settle

    const pdfBuf = await page.pdf({
      width: "13.333in",
      height: "7.5in",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    pages.push(Buffer.from(pdfBuf));
  }

  await browser.close();

  // For V2-0, return just the first page's PDF (multi-page merge needs pdf-lib, added in V2-2)
  // In practice the full slideshow PDF works as single render too
  if (pages.length === 0) return Buffer.alloc(0);

  // Simple approach: re-render all slides visible and print
  const browser2 = await chromium.launch({ headless: true });
  const page2 = await browser2.newPage({ viewport: { width: 1280, height: 720 } });

  // Create a multi-page version: one slide per "page" via CSS page breaks
  const multiPageHtml = htmlContent
    .replace(/<style>/, `<style>
      @media print { .slide { display:block !important; page-break-after:always; position:relative !important; } }
    `);

  await page2.setContent(multiPageHtml, { waitUntil: "networkidle" });
  await page2.evaluate(() => {
    document.querySelectorAll(".slide").forEach((s) => {
      (s as HTMLElement).style.display = "block";
    });
    const hint = document.getElementById("nav-hint");
    if (hint) hint.style.display = "none";
  });

  const fullPdf = await page2.pdf({
    width: "13.333in",
    height: "7.5in",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser2.close();
  return Buffer.from(fullPdf);
}

