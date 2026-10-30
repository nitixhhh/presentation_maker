import { chromium } from "playwright";
import { PresentationDeck } from "@/schemas/presentation";
import { generateSlideshowHtml } from "./htmlExport";

export class PdfExporter {
  public static async generate(deck: PresentationDeck): Promise<Buffer> {
    const html = generateSlideshowHtml(deck);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });

      // Generate PDF buffer
      const pdfBuffer = await page.pdf({
        width: "1920px",
        height: "1080px",
        printBackground: true,
        pageRanges: "1",
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
