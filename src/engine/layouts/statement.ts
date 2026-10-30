/**
 * Engine v2 — Layout: Statement
 *
 * Large centered statement (28-40pt). Minimal, high-impact.
 * Variants: 0 = centered, 1 = left-aligned with accent bar
 */

import type { Shape } from "../sceneGraph";
import type { DesignSystemTokens } from "../sceneGraph";
import type {
  LayoutDefinition,
  LayoutBuildParams,
  RNG,
  Slot,
  TextSlotContent,
} from "./types";
import { CANVAS, SAFE_AREA, gridCol } from "../canvas";

function sid(slideIndex: number, name: string): string {
  return `slide-${slideIndex}-${name}`;
}

const slots: Record<string, Slot> = {
  kicker: {
    kind: "text",
    role: "kicker",
    rect: { x: SAFE_AREA.x, y: SAFE_AREA.y + 0.5, w: 3.0, h: 0.35 },
    minPt: 10,
    maxPt: 13,
    maxChars: 30,
    maxLines: 1,
    align: "center",
    bold: true,
    textTransform: "uppercase",
  },
  title: {
    kind: "text",
    role: "title",
    rect: { x: SAFE_AREA.x + 1.0, y: 2.0, w: SAFE_AREA.w - 2.0, h: 3.0 },
    minPt: 28,
    maxPt: 40,
    maxChars: 100,
    maxLines: 4,
    align: "center",
    valign: "middle",
    bold: true,
  },
  body: {
    kind: "text",
    role: "body",
    rect: { x: SAFE_AREA.x + 2.0, y: 5.2, w: SAFE_AREA.w - 4.0, h: 1.2 },
    minPt: 14,
    maxPt: 18,
    maxChars: 200,
    maxLines: 3,
    align: "center",
  },
};

function decorations(ds: DesignSystemTokens, _rng: RNG): Shape[] {
  return [
    // Oversized opening quote mark
    {
      type: "text" as const,
      id: "deco-quote-open",
      rect: { x: SAFE_AREA.x + 0.5, y: 1.2, w: 1.5, h: 1.5 },
      runs: [{ text: "\u201C", fontSize: 120, color: ds.palette.primary }],
      style: {
        fontFamily: ds.fonts.pptxHeading,
        fontSize: 120,
        color: ds.palette.primary,
        align: "left" as const,
        valign: "top" as const,
      },
      opacity: 0.15,
    },
    // Subtle gradient background overlay
    {
      type: "rect" as const,
      id: "deco-gradient-bg",
      rect: { x: 0, y: 0, w: CANVAS.W, h: CANVAS.H },
      fill: {
        kind: "gradient" as const,
        type: "radial" as const,
        stops: [
          { color: ds.palette.primary, pos: 0 },
          { color: ds.palette.bg, pos: 100 },
        ],
      },
      opacity: 0.06,
    },
    // Accent dot
    {
      type: "rect" as const,
      id: "deco-accent-dot",
      rect: { x: CANVAS.W / 2 - 0.12, y: 6.5, w: 0.24, h: 0.24 },
      fill: { kind: "solid" as const, color: ds.palette.accent },
      cornerRadius: 0.12,
    },
  ];
}

function buildShapes(params: LayoutBuildParams): Shape[] {
  const { ds, slotContent, variant, slideIndex } = params;
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const fonts = ds.fonts;
  const isCentered = variant === 0;

  // Subtle gradient bg
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-1"),
    rect: { x: 0, y: 0, w: CANVAS.W, h: CANVAS.H },
    fill: {
      kind: "gradient",
      type: "radial",
      stops: [
        { color: pal.primary, pos: 0 },
        { color: pal.bg, pos: 100 },
      ],
    },
    opacity: 0.05,
    zIndex: 0,
  });

  // Oversized quote marks
  shapes.push({
    type: "text",
    id: sid(slideIndex, "deco-2"),
    rect: {
      x: isCentered ? SAFE_AREA.x + 0.5 : SAFE_AREA.x + 1.0,
      y: 1.0,
      w: 1.5,
      h: 1.5,
    },
    runs: [{ text: "\u201C", fontSize: 120, color: pal.primary }],
    style: {
      fontFamily: fonts.pptxHeading,
      fontSize: 120,
      color: pal.primary,
      align: "left",
      valign: "top",
    },
    opacity: 0.12,
    zIndex: 1,
  });

  // Kicker
  const kickerContent = slotContent["kicker"] as TextSlotContent | undefined;
  if (kickerContent?.text) {
    const kickerX = isCentered ? (CANVAS.W - 3) / 2 : SAFE_AREA.x + 1.5;
    shapes.push({
      type: "text",
      id: sid(slideIndex, "kicker"),
      rect: { x: kickerX, y: SAFE_AREA.y + 0.5, w: 3.0, h: 0.35 },
      runs: [{ text: kickerContent.text, bold: true, fontSize: 11, color: pal.textMuted }],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 11,
        color: pal.textMuted,
        bold: true,
        align: isCentered ? "center" : "left",
        textTransform: "uppercase",
        charSpacing: 2,
      },
      zIndex: 3,
    });
  }

  // Accent bar (variant 1 only)
  if (!isCentered) {
    shapes.push({
      type: "rect",
      id: sid(slideIndex, "deco-3"),
      rect: { x: SAFE_AREA.x + 1.0, y: 2.0, w: 0.07, h: 3.0 },
      fill: { kind: "solid", color: pal.accent },
      cornerRadius: 0.035,
      zIndex: 2,
    });
  }

  // Title (main statement)
  const titleContent = slotContent["title"] as TextSlotContent | undefined;
  const titleX = isCentered ? SAFE_AREA.x + 1.0 : SAFE_AREA.x + 1.5;
  const titleW = isCentered ? SAFE_AREA.w - 2.0 : SAFE_AREA.w - 3.0;
  shapes.push({
    type: "text",
    id: sid(slideIndex, "title"),
    rect: { x: titleX, y: 2.0, w: titleW, h: 3.2 },
    runs: [{ text: titleContent?.text ?? "", bold: true, fontSize: 34, color: pal.text }],
    style: {
      fontFamily: fonts.pptxHeading,
      fontSize: 34,
      color: pal.text,
      bold: true,
      align: isCentered ? "center" : "left",
      valign: "middle",
      lineHeight: 1.3,
    },
    zIndex: 3,
  });

  // Body text
  const bodyContent = slotContent["body"] as TextSlotContent | undefined;
  if (bodyContent?.text) {
    const bodyX = isCentered ? SAFE_AREA.x + 2.0 : SAFE_AREA.x + 1.5;
    const bodyW = isCentered ? SAFE_AREA.w - 4.0 : SAFE_AREA.w - 3.0;
    shapes.push({
      type: "text",
      id: sid(slideIndex, "body"),
      rect: { x: bodyX, y: 5.3, w: bodyW, h: 1.2 },
      runs: [{ text: bodyContent.text, fontSize: 16, color: pal.textMuted }],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 16,
        color: pal.textMuted,
        align: isCentered ? "center" : "left",
        valign: "top",
        lineHeight: 1.5,
      },
      zIndex: 3,
    });
  }

  // Accent dot at bottom center
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-4"),
    rect: {
      x: isCentered ? CANVAS.W / 2 - 0.12 : SAFE_AREA.x + 1.5,
      y: 6.6,
      w: 0.24,
      h: 0.24,
    },
    fill: { kind: "solid", color: pal.accent },
    cornerRadius: 0.12,
    zIndex: 2,
  });

  return shapes;
}

export const layout: LayoutDefinition = {
  id: "statement",
  name: "Statement",
  roles: ["statement", "section"],
  density: "low",
  slots,
  decorations,
  variants: 2,
  buildShapes,
};
