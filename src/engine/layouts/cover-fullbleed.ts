/**
 * Engine v2 — Layout: Cover Full-Bleed
 *
 * Full-bleed background image with gradient scrim.
 * Title centered large (48-64pt), subtitle below. Kicker badge top-left.
 * Variants: 0 = center-aligned, 1 = left-aligned, 2 = bottom-aligned
 */

import type { Shape, TextStyle, Fill, Rect } from "../sceneGraph";
import type { DesignSystemTokens } from "../sceneGraph";
import type {
  LayoutDefinition,
  LayoutBuildParams,
  RNG,
  Slot,
  TextSlotContent,
  ImageSlotContent,
} from "./types";
import { CANVAS, SAFE_AREA, gridCol } from "../canvas";

/** Helper: id prefix for a slide */
function sid(slideIndex: number, name: string): string {
  return `slide-${slideIndex}-${name}`;
}

/** Slot definitions for cover-fullbleed */
const slots: Record<string, Slot> = {
  kicker: {
    kind: "text",
    role: "kicker",
    rect: { x: SAFE_AREA.x, y: SAFE_AREA.y, w: 4, h: 0.4 },
    minPt: 10,
    maxPt: 14,
    maxChars: 30,
    maxLines: 1,
    align: "left",
    bold: true,
    textTransform: "uppercase",
  },
  title: {
    kind: "text",
    role: "title",
    rect: { x: SAFE_AREA.x, y: 2.5, w: SAFE_AREA.w, h: 2.0 },
    minPt: 48,
    maxPt: 64,
    maxChars: 60,
    maxLines: 3,
    align: "center",
    valign: "middle",
    bold: true,
  },
  subtitle: {
    kind: "text",
    role: "subtitle",
    rect: { x: SAFE_AREA.x + 1.5, y: 4.6, w: SAFE_AREA.w - 3.0, h: 1.0 },
    minPt: 18,
    maxPt: 24,
    maxChars: 100,
    maxLines: 2,
    align: "center",
    valign: "top",
  },
  bgImage: {
    kind: "image",
    rect: { x: 0, y: 0, w: CANVAS.W, h: CANVAS.H },
    aspectRatio: CANVAS.W / CANVAS.H,
    objectFit: "cover",
    fullBleed: true,
  },
};

/** Decorations: accent bar + circle accent */
function decorations(ds: DesignSystemTokens, rng: RNG): Shape[] {
  const shapes: Shape[] = [];

  // Accent bar at top
  shapes.push({
    type: "rect",
    id: "deco-accent-bar",
    rect: { x: SAFE_AREA.x, y: SAFE_AREA.y + 0.5, w: 2.0, h: 0.06 },
    fill: { kind: "solid", color: ds.palette.accent },
    cornerRadius: ds.shape.radius,
  });

  // Circle accent element
  const cx = rng() > 0.5 ? 11.5 : 1.5;
  shapes.push({
    type: "rect",
    id: "deco-circle-accent",
    rect: { x: cx, y: 6.0, w: 0.5, h: 0.5 },
    fill: { kind: "solid", color: ds.palette.primary, opacity: 0.3 },
    cornerRadius: 0.25,
  });

  return shapes;
}

/** Build shapes for cover-fullbleed layout */
function buildShapes(params: LayoutBuildParams): Shape[] {
  const { ds, slotContent, variant, rng, slideIndex } = params;
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const fonts = ds.fonts;

  // 1. Full-bleed background image
  const bgContent = slotContent["bgImage"] as ImageSlotContent | undefined;
  shapes.push({
    type: "image",
    id: sid(slideIndex, "bg-image"),
    rect: { x: 0, y: 0, w: CANVAS.W, h: CANVAS.H },
    src: bgContent?.src ?? "",
    alt: bgContent?.alt ?? "Background",
    objectFit: "cover",
    overlay: {
      kind: "gradient",
      type: "linear",
      angle: 180,
      stops: [
        { color: "#000000", pos: 0 },
        { color: "#000000", pos: 100 },
      ],
    },
    zIndex: 0,
    opacity: 1,
  });

  // 2. Gradient scrim overlay for text readability
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "scrim"),
    rect: { x: 0, y: 0, w: CANVAS.W, h: CANVAS.H },
    fill: {
      kind: "gradient",
      type: "linear",
      angle: 180,
      stops: [
        { color: pal.bg, pos: 0 },
        { color: pal.bg, pos: 100 },
      ],
    },
    opacity: 0.55,
    zIndex: 1,
  });

  // Variant-specific positioning
  let titleRect: Rect;
  let subtitleRect: Rect;
  let kickerRect: Rect;
  let titleAlign: "left" | "center" | "right" = "center";

  switch (variant) {
    case 1: {
      // Left-aligned
      const col = gridCol(1, 7);
      titleRect = { x: col.x, y: 2.2, w: col.w, h: 2.2 };
      subtitleRect = { x: col.x, y: 4.5, w: col.w, h: 1.0 };
      kickerRect = { x: col.x, y: 1.6, w: 4, h: 0.4 };
      titleAlign = "left";
      break;
    }
    case 2: {
      // Bottom-aligned
      titleRect = { x: SAFE_AREA.x, y: 4.0, w: SAFE_AREA.w, h: 1.8 };
      subtitleRect = { x: SAFE_AREA.x + 2, y: 5.9, w: SAFE_AREA.w - 4, h: 0.8 };
      kickerRect = { x: SAFE_AREA.x, y: 3.5, w: 4, h: 0.4 };
      titleAlign = "center";
      break;
    }
    default: {
      // Center-aligned (default)
      titleRect = { x: SAFE_AREA.x, y: 2.4, w: SAFE_AREA.w, h: 2.2 };
      subtitleRect = { x: SAFE_AREA.x + 1.5, y: 4.7, w: SAFE_AREA.w - 3.0, h: 1.0 };
      kickerRect = { x: SAFE_AREA.x, y: 1.8, w: 4, h: 0.4 };
      titleAlign = "center";
      break;
    }
  }

  // 3. Kicker badge
  const kickerContent = slotContent["kicker"] as TextSlotContent | undefined;
  if (kickerContent?.text) {
    // Kicker background badge
    shapes.push({
      type: "rect",
      id: sid(slideIndex, "kicker-bg"),
      rect: {
        x: titleAlign === "center" ? (CANVAS.W - 3) / 2 : kickerRect.x,
        y: kickerRect.y,
        w: 3,
        h: 0.35,
      },
      fill: { kind: "solid", color: pal.primary, opacity: 0.9 },
      cornerRadius: ds.shape.radius,
      zIndex: 2,
    });
    shapes.push({
      type: "text",
      id: sid(slideIndex, "kicker"),
      rect: {
        x: titleAlign === "center" ? (CANVAS.W - 3) / 2 : kickerRect.x,
        y: kickerRect.y,
        w: 3,
        h: 0.35,
      },
      runs: [{ text: kickerContent.text, bold: true, fontSize: 11, color: pal.onPrimary }],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 11,
        color: pal.onPrimary,
        bold: true,
        align: "center",
        valign: "middle",
        textTransform: "uppercase",
      },
      zIndex: 3,
    });
  }

  // 4. Title
  const titleContent = slotContent["title"] as TextSlotContent | undefined;
  shapes.push({
    type: "text",
    id: sid(slideIndex, "title"),
    rect: titleRect,
    runs: [
      {
        text: titleContent?.text ?? "",
        bold: true,
        fontSize: 56,
        color: pal.text,
      },
    ],
    style: {
      fontFamily: fonts.pptxHeading,
      fontSize: 56,
      color: pal.text,
      bold: true,
      align: titleAlign,
      valign: "middle",
      lineHeight: 1.1,
    },
    zIndex: 4,
  });

  // 5. Subtitle
  const subtitleContent = slotContent["subtitle"] as TextSlotContent | undefined;
  if (subtitleContent?.text) {
    shapes.push({
      type: "text",
      id: sid(slideIndex, "subtitle"),
      rect: subtitleRect,
      runs: [
        {
          text: subtitleContent.text,
          fontSize: 20,
          color: pal.textMuted,
        },
      ],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 20,
        color: pal.textMuted,
        align: titleAlign,
        valign: "top",
        lineHeight: 1.4,
      },
      zIndex: 4,
    });
  }

  // 6. Decorative accent bar
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-1"),
    rect: {
      x: titleAlign === "center" ? (CANVAS.W - 2.5) / 2 : titleRect.x,
      y: titleRect.y + titleRect.h + 0.1,
      w: 2.5,
      h: 0.06,
    },
    fill: { kind: "solid", color: pal.accent },
    cornerRadius: 0.03,
    zIndex: 3,
  });

  // 7. Decorative circle
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-2"),
    rect: { x: CANVAS.W - 1.8, y: CANVAS.H - 1.8, w: 1.2, h: 1.2 },
    fill: { kind: "solid", color: pal.primary, opacity: 0.15 },
    cornerRadius: 0.6,
    zIndex: 1,
  });

  return shapes;
}

/** Cover Full-Bleed layout definition */
export const layout: LayoutDefinition = {
  id: "cover-fullbleed",
  name: "Cover — Full-Bleed Image",
  roles: ["cover"],
  density: "low",
  slots,
  decorations,
  variants: 3,
  buildShapes,
};
