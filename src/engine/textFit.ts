/**
 * Engine v2 — Text Fitting (V2-0: character-width approximation)
 *
 * For V2-0 we use an average character width heuristic.
 * V2-2 will add real fontkit-based measurement with actual .ttf files.
 */

import type { Rect } from "./sceneGraph";

/** Average character width as a fraction of font size (in inches at 72 DPI) */
const AVG_CHAR_WIDTH_SANS = 0.55;
const AVG_CHAR_WIDTH_SERIF = 0.50;
const AVG_CHAR_WIDTH_MONO = 0.60;

function getCharWidthFactor(fontFamily: string): number {
  const f = fontFamily.toLowerCase();
  if (f.includes("mono") || f.includes("code") || f.includes("consola")) return AVG_CHAR_WIDTH_MONO;
  if (f.includes("serif") || f.includes("georgia") || f.includes("cambria") || f.includes("times") || f.includes("newsreader") || f.includes("playfair")) return AVG_CHAR_WIDTH_SERIF;
  return AVG_CHAR_WIDTH_SANS;
}

/** Convert font size in pt to inches */
function ptToIn(pt: number): number {
  return pt / 72;
}

export interface TextMeasureResult {
  fits: boolean;
  lines: number;
  suggestedFontSize: number;
}

/**
 * Measure if text fits in a rect at a given font size.
 * Returns estimated line count and whether it fits.
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  rect: Rect
): TextMeasureResult {
  const charWidthIn = ptToIn(fontSize) * getCharWidthFactor(fontFamily);
  const lineHeightIn = ptToIn(fontSize) * 1.4; // 1.4× line height
  const charsPerLine = Math.max(1, Math.floor(rect.w / charWidthIn));
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeightIn));

  // Word-wrap estimation
  const words = text.split(/\s+/);
  let currentLineLen = 0;
  let lineCount = 1;

  for (const word of words) {
    const wordLen = word.length;
    if (currentLineLen + wordLen + (currentLineLen > 0 ? 1 : 0) > charsPerLine) {
      lineCount++;
      currentLineLen = wordLen;
    } else {
      currentLineLen += (currentLineLen > 0 ? 1 : 0) + wordLen;
    }
  }

  return {
    fits: lineCount <= maxLines,
    lines: lineCount,
    suggestedFontSize: fontSize,
  };
}

export interface TextFitResult {
  fontSize: number;
  fits: boolean;
  needsShorten: boolean;
}

/**
 * Fit text into a slot by shrinking font size from maxPt to minPt.
 * If text still doesn't fit at minPt, returns needsShorten: true.
 */
export function fitTextToSlot(
  text: string,
  fontFamily: string,
  slot: {
    minPt: number;
    maxPt: number;
    maxChars: number;
    maxLines: number;
    rect: Rect;
  }
): TextFitResult {
  // Hard char limit check
  if (text.length > slot.maxChars * 1.2) {
    return { fontSize: slot.minPt, fits: false, needsShorten: true };
  }

  // Try from maxPt down to minPt
  for (let pt = slot.maxPt; pt >= slot.minPt; pt--) {
    const result = measureText(text, pt, fontFamily, slot.rect);
    if (result.fits && result.lines <= slot.maxLines) {
      return { fontSize: pt, fits: true, needsShorten: false };
    }
  }

  // Doesn't fit even at minimum size
  return { fontSize: slot.minPt, fits: false, needsShorten: true };
}

/**
 * Fit a list of items into a list slot.
 * Returns the fontSize that makes all items fit.
 */
export function fitListToSlot(
  items: string[],
  fontFamily: string,
  slot: {
    minPt: number;
    maxPt: number;
    maxItems: number;
    maxCharsPerItem: number;
    rect: Rect;
  }
): TextFitResult {
  const effectiveItems = items.slice(0, slot.maxItems);
  const itemHeight = slot.rect.h / Math.max(effectiveItems.length, 1);

  for (let pt = slot.maxPt; pt >= slot.minPt; pt--) {
    const itemRect: Rect = { x: slot.rect.x, y: slot.rect.y, w: slot.rect.w, h: itemHeight * 0.85 };
    let allFit = true;
    for (const item of effectiveItems) {
      const result = measureText(item, pt, fontFamily, itemRect);
      if (!result.fits) { allFit = false; break; }
    }
    if (allFit) return { fontSize: pt, fits: true, needsShorten: false };
  }

  return { fontSize: slot.minPt, fits: false, needsShorten: true };
}

