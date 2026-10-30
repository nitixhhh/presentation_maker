import { PresentationDeck } from "@/schemas/presentation";

export interface QaIssue {
  slideIndex: number;
  type: "word_limit" | "layout_repetition" | "missing_visual" | "contrast_warning" | "schema_error";
  message: string;
}

export interface DeterministicQaResult {
  passed: boolean;
  issues: QaIssue[];
}

export class DeterministicQa {
  /**
   * Calculates relative luminance of a hex color.
   */
  private static getLuminance(hex: string): number {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return 0.5;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const sRGB = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }

  /**
   * Calculates WCAG contrast ratio between two hex colors.
   */
  public static calculateContrastRatio(hex1: string, hex2: string): number {
    const lum1 = this.getLuminance(hex1);
    const lum2 = this.getLuminance(hex2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  public static inspectDeck(deck: PresentationDeck): DeterministicQaResult {
    const issues: QaIssue[] = [];

    // 1. Contrast Check on Palette
    const bg = deck.designDna.palette.background;
    const text = deck.designDna.palette.text;
    const ratio = this.calculateContrastRatio(bg, text);
    if (ratio < 4.5) {
      issues.push({
        slideIndex: 0,
        type: "contrast_warning",
        message: `Contrast ratio between text (${text}) and background (${bg}) is ${ratio.toFixed(2)}:1 (minimum recommended: 4.5:1).`,
      });
    }

    // 2. Layout Repetition Check
    let repeatCount = 1;
    let prevLayout = "";
    deck.slides.forEach((slide, idx) => {
      if (slide.layoutType === prevLayout) {
        repeatCount++;
        if (repeatCount > 2) {
          issues.push({
            slideIndex: idx + 1,
            type: "layout_repetition",
            message: `Layout "${slide.layoutType}" repeated ${repeatCount} times consecutively. Max allowed is 2.`,
          });
        }
      } else {
        repeatCount = 1;
      }
      prevLayout = slide.layoutType;

      // 3. Word Limits & Bullet count
      if (slide.bodyPoints.length > 4) {
        issues.push({
          slideIndex: idx + 1,
          type: "word_limit",
          message: `Slide contains ${slide.bodyPoints.length} points (maximum recommended is 4 to avoid clutter).`,
        });
      }

      slide.bodyPoints.forEach((point, pIdx) => {
        const wordCount = point.trim().split(/\s+/).length;
        if (wordCount > 22) {
          issues.push({
            slideIndex: idx + 1,
            type: "word_limit",
            message: `Bullet point #${pIdx + 1} has ${wordCount} words (exceeds 22 word limit).`,
          });
        }
      });

      // 4. Missing Visual Check
      if (slide.visualElement.type === "none" && slide.layoutType !== "hero-title" && slide.layoutType !== "closing-cta") {
        issues.push({
          slideIndex: idx + 1,
          type: "missing_visual",
          message: `Slide has no visual element assigned. Every content slide must have a visual component.`,
        });
      }
    });

    return {
      passed: issues.filter((i) => i.type !== "contrast_warning").length === 0,
      issues,
    };
  }
}
