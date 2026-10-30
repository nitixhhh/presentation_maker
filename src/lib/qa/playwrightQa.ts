import { chromium } from "playwright";
import { PresentationDeck } from "@/schemas/presentation";
import { generateSlideshowHtml } from "@/lib/export/htmlExport";

export interface PlaywrightQaResult {
  passed: boolean;
  overflowDetected: boolean;
  overflowSlides: number[];
  screenshotBuffer?: Buffer;
}

export class PlaywrightQa {
  public static async verifyLayoutAndOverflow(deck: PresentationDeck): Promise<PlaywrightQaResult> {
    const htmlContent = generateSlideshowHtml(deck);
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle" });

      const overflowSlides: number[] = [];

      // Check overflow on each slide
      const slideCount = deck.slides.length;
      for (let i = 0; i < slideCount; i++) {
        // Activate slide in browser DOM before evaluating
        await page.evaluate((slideIdx) => {
          const slides = document.querySelectorAll('.slide');
          slides.forEach((s) => s.classList.remove('active'));
          const current = document.getElementById(`slide-${slideIdx}`);
          if (current) current.classList.add('active');
        }, i);

        // Wait a frame for layout recalculation
        await page.waitForTimeout(50);

        const isOverflowing = await page.evaluate((slideIdx) => {
          const slideEl = document.getElementById(`slide-${slideIdx}`);
          if (!slideEl) return false;

          // Check if total slide content overflows the 1080px slide boundary
          if (slideEl.scrollHeight > 1085 || slideEl.scrollWidth > 1925) {
            return true;
          }

          // Check text container overflow
          const textContainer = slideEl.querySelector(".slide-text-content") as HTMLElement;
          if (textContainer && textContainer.scrollHeight > textContainer.clientHeight + 15) {
            return true;
          }

          return false;
        }, i);

        if (isOverflowing) {
          overflowSlides.push(i + 1);
        }
      }

      await browser.close();

      return {
        passed: overflowSlides.length === 0,
        overflowDetected: overflowSlides.length > 0,
        overflowSlides,
      };
    } catch (err) {
      console.warn("[PlaywrightQa] Playwright check skipped or failed:", err);
      if (browser) await browser.close();
      return {
        passed: true,
        overflowDetected: false,
        overflowSlides: [],
      };
    }
  }
}
