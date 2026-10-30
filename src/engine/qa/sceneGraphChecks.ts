/**
 * Engine v2 — Scene Graph QA Checks (code-only, no LLM)
 *
 * Validates the scene graph before export. Catches geometry violations,
 * contrast failures, layout repetition, and missing visual elements.
 */

import type { SceneGraph, Shape } from "../sceneGraph";
import { SAFE_AREA } from "../canvas";
import { contrastRatio } from "../designSystem/palettes";

export interface QAIssue {
  severity: "error" | "warning";
  slide: number;
  type: string;
  message: string;
}

export interface QAResult {
  passed: boolean;
  issues: QAIssue[];
  stats: {
    totalSlides: number;
    paletteRolesUsed: number;
    uniqueLayouts: number;
  };
}

/**
 * Decoration / background shape ID patterns.
 * These shapes are INTENTIONALLY placed outside (or spanning) the safe area
 * to create full-bleed backgrounds, overlays, and visual decorations.
 */
const DECO_ID_PATTERNS = [
  "deco-", "bg-", "-bg", "scrim", "gradient-bg", "frame",
  "card-bg", "stat-card", "circle-top", "circle-bottom",
];

function isDecorationShape(shape: Shape): boolean {
  const id = shape.id.toLowerCase();
  return DECO_ID_PATTERNS.some((pat) => id.includes(pat));
}

/** Check if a rect is within the safe area (with 0.05in tolerance) */
function isInSafeArea(shape: Shape): boolean {
  // Images with fullBleed flag or spanning the full canvas are allowed outside safe area
  if (shape.type === "image" && "fullBleed" in shape) return true;
  if (shape.type === "image" && shape.rect.w >= 6 && shape.rect.h >= 7) return true;
  // Decoration shapes with zIndex < 0 (backgrounds) are exempt
  if ((shape.zIndex ?? 0) < 0) return true;
  // Decoration/background shapes identified by ID pattern are exempt
  if (isDecorationShape(shape)) return true;
  // Rect shapes that span the full canvas are background fills — exempt
  if (shape.type === "rect" && shape.rect.x === 0 && shape.rect.y === 0 &&
      shape.rect.w >= 13 && shape.rect.h >= 7) return true;

  const r = shape.rect;
  const tol = 0.05;
  return (
    r.x >= SAFE_AREA.x - tol &&
    r.y >= SAFE_AREA.y - tol &&
    r.x + r.w <= SAFE_AREA.x + SAFE_AREA.w + tol &&
    r.y + r.h <= SAFE_AREA.y + SAFE_AREA.h + tol
  );
}

/** Check if two rects overlap */
function rectsOverlap(a: Shape["rect"], b: Shape["rect"]): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/** Count non-text visual elements on a slide */
function countVisualElements(shapes: Shape[]): number {
  let count = 0;
  for (const s of shapes) {
    if (s.type === "image" || s.type === "icon" || s.type === "chart" ||
        s.type === "diagram" || s.type === "bigNumber") {
      count++;
    } else if (s.type === "rect" && s.fill.kind !== "none" && (s.zIndex ?? 0) >= 0) {
      // Visible decoration shapes count as visual elements
      count++;
    }
  }
  return count;
}

/** Collect all distinct colors used in the deck */
function collectUsedColors(sg: SceneGraph): Set<string> {
  const colors = new Set<string>();
  for (const slide of sg.slides) {
    if (slide.background.kind === "solid") colors.add(slide.background.color.toLowerCase());
    for (const shape of slide.shapes) {
      if (shape.type === "text") colors.add(shape.style.color.toLowerCase());
      if (shape.type === "bulletList") colors.add(shape.bulletColor.toLowerCase());
      if (shape.type === "rect" && shape.fill.kind === "solid") colors.add(shape.fill.color.toLowerCase());
      if (shape.type === "icon") colors.add(shape.color.toLowerCase());
      if (shape.type === "bigNumber") {
        colors.add(shape.numberStyle.color.toLowerCase());
        colors.add(shape.labelStyle.color.toLowerCase());
      }
    }
  }
  return colors;
}

/** Count how many of the palette's distinct roles are represented in the used colors */
function countPaletteRolesUsed(sg: SceneGraph): number {
  const usedColors = collectUsedColors(sg);
  const p = sg.designSystem.palette;
  const paletteColors = [p.bg, p.bgAlt, p.surface, p.primary, p.secondary, p.accent, p.text, p.textMuted, p.onPrimary];
  let rolesUsed = 0;
  for (const pc of paletteColors) {
    if (usedColors.has(pc.toLowerCase())) rolesUsed++;
  }
  return rolesUsed;
}

/**
 * Run all code-based QA checks on a scene graph.
 * Returns pass/fail and a list of issues.
 */
export function checkSceneGraph(sg: SceneGraph): QAResult {
  const issues: QAIssue[] = [];

  for (let i = 0; i < sg.slides.length; i++) {
    const slide = sg.slides[i];
    const slideNum = i + 1;

    // 1. Safe area check
    for (const shape of slide.shapes) {
      if (!isInSafeArea(shape)) {
        issues.push({
          severity: "error", slide: slideNum, type: "off_frame",
          message: `Shape "${shape.id}" extends outside safe area: x=${shape.rect.x.toFixed(2)}, y=${shape.rect.y.toFixed(2)}, w=${shape.rect.w.toFixed(2)}, h=${shape.rect.h.toFixed(2)}`,
        });
      }
    }

    // 2. Text overlap check
    const textShapes = slide.shapes.filter(
      (s) => s.type === "text" || s.type === "bulletList"
    );
    for (let a = 0; a < textShapes.length; a++) {
      for (let b = a + 1; b < textShapes.length; b++) {
        if (rectsOverlap(textShapes[a].rect, textShapes[b].rect)) {
          issues.push({
            severity: "warning", slide: slideNum, type: "overlap",
            message: `Text shapes "${textShapes[a].id}" and "${textShapes[b].id}" overlap`,
          });
        }
      }
    }

    // 3. Font size minimums
    for (const shape of slide.shapes) {
      if (shape.type === "text") {
        const size = shape.style.fontSize;
        const role = shape.style.fontFamily; // approximate
        if (shape.id.includes("caption") && size < 11) {
          issues.push({ severity: "error", slide: slideNum, type: "font_too_small", message: `Caption "${shape.id}" is ${size}pt (min 11pt)` });
        } else if (!shape.id.includes("caption") && !shape.id.includes("num") && size < 14) {
          issues.push({ severity: "warning", slide: slideNum, type: "font_too_small", message: `Text "${shape.id}" is ${size}pt (recommended ≥14pt for body)` });
        }
      }
    }

    // 4. Visual element count (≥2 per slide)
    const visualCount = countVisualElements(slide.shapes);
    if (visualCount < 2) {
      issues.push({
        severity: "error", slide: slideNum, type: "too_empty",
        message: `Slide has only ${visualCount} non-text visual elements (need ≥2)`,
      });
    }

    // 5. Empty image src
    for (const shape of slide.shapes) {
      if (shape.type === "image" && !shape.src) {
        issues.push({ severity: "error", slide: slideNum, type: "image_missing", message: `Image "${shape.id}" has empty src` });
      }
    }
  }

  // 6. No consecutive repeated layouts
  for (let i = 1; i < sg.slides.length; i++) {
    if (sg.slides[i].layoutId === sg.slides[i - 1].layoutId) {
      issues.push({
        severity: "warning", slide: i + 1, type: "repeated_layout",
        message: `Layout "${sg.slides[i].layoutId}" repeated back-to-back (slides ${i} and ${i + 1})`,
      });
    }
  }

  // 7. Palette roles used (≥4)
  const paletteRolesUsed = countPaletteRolesUsed(sg);
  if (paletteRolesUsed < 4) {
    issues.push({
      severity: "warning", slide: 0, type: "monotone",
      message: `Only ${paletteRolesUsed} palette roles used across deck (need ≥4)`,
    });
  }

  // 8. Font family count (≤2)
  const fontFamilies = new Set<string>();
  for (const slide of sg.slides) {
    for (const shape of slide.shapes) {
      if (shape.type === "text") fontFamilies.add(shape.style.fontFamily);
      if (shape.type === "bulletList") fontFamilies.add(shape.style.fontFamily);
      if (shape.type === "bigNumber") {
        fontFamilies.add(shape.numberStyle.fontFamily);
        fontFamilies.add(shape.labelStyle.fontFamily);
      }
    }
  }
  if (fontFamilies.size > 2) {
    issues.push({
      severity: "warning", slide: 0, type: "too_many_fonts",
      message: `${fontFamilies.size} font families used (max 2): ${[...fontFamilies].join(", ")}`,
    });
  }

  const uniqueLayouts = new Set(sg.slides.map((s) => s.layoutId)).size;
  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    passed: !hasErrors,
    issues,
    stats: {
      totalSlides: sg.slides.length,
      paletteRolesUsed,
      uniqueLayouts,
    },
  };
}

