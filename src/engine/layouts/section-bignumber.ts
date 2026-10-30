/**
 * Engine v2 — Layout: Section Big Number
 *
 * Giant number dominates (80-120pt). Label below. Optional supporting image.
 * Variants: 0 = number-left, 1 = number-center
 */

import type { Shape } from "../sceneGraph";
import type { DesignSystemTokens } from "../sceneGraph";
import type {
  LayoutDefinition,
  LayoutBuildParams,
  RNG,
  Slot,
  TextSlotContent,
  BigNumberSlotContent,
  ImageSlotContent,
} from "./types";
import { CANVAS, SAFE_AREA, gridCol } from "../canvas";

function sid(slideIndex: number, name: string): string {
  return `slide-${slideIndex}-${name}`;
}

const slots: Record<string, Slot> = {
  bigNumber: {
    kind: "bigNumber",
    rect: { x: SAFE_AREA.x, y: 1.5, w: 6.0, h: 3.5 },
    numberMaxPt: 120,
    numberMinPt: 80,
    labelMaxPt: 20,
  },
  caption: {
    kind: "text",
    role: "caption",
    rect: { x: SAFE_AREA.x, y: 5.5, w: 8.0, h: 1.0 },
    minPt: 14,
    maxPt: 18,
    maxChars: 80,
    maxLines: 2,
    align: "left",
  },
  image: {
    kind: "image",
    rect: { ...gridCol(7, 6), y: SAFE_AREA.y, h: SAFE_AREA.h },
    aspectRatio: 1,
    objectFit: "cover",
    cornerRadius: 0.15,
  },
};

function decorations(ds: DesignSystemTokens, _rng: RNG): Shape[] {
  return [
    // Large circle behind number
    {
      type: "rect" as const,
      id: "deco-bg-circle",
      rect: { x: 1.2, y: 1.0, w: 4.5, h: 4.5 },
      fill: { kind: "solid" as const, color: ds.palette.primary, opacity: 0.1 },
      cornerRadius: 2.25,
    },
    // Accent bar below number
    {
      type: "rect" as const,
      id: "deco-accent-bar",
      rect: { x: SAFE_AREA.x, y: 5.2, w: 3.0, h: 0.06 },
      fill: { kind: "solid" as const, color: ds.palette.accent },
      cornerRadius: 0.03,
    },
  ];
}

function buildShapes(params: LayoutBuildParams): Shape[] {
  const { ds, slotContent, variant, slideIndex } = params;
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const fonts = ds.fonts;
  const centered = variant === 1;

  const bnContent = slotContent["bigNumber"] as BigNumberSlotContent | undefined;
  const captionContent = slotContent["caption"] as TextSlotContent | undefined;
  const imgContent = slotContent["image"] as ImageSlotContent | undefined;

  const hasImage = imgContent?.src;
  const numCols = hasImage ? gridCol(1, 6) : gridCol(1, 12);
  const numX = centered && !hasImage ? (CANVAS.W - numCols.w) / 2 : numCols.x;
  const numAlign: "left" | "center" = centered && !hasImage ? "center" : "left";

  // Background circle behind number
  const circleSize = 4.5;
  const circleX = centered && !hasImage ? (CANVAS.W - circleSize) / 2 : 1.2;
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-1"),
    rect: { x: circleX, y: 0.8, w: circleSize, h: circleSize },
    fill: { kind: "solid", color: pal.primary, opacity: 0.08 },
    cornerRadius: circleSize / 2,
    zIndex: 0,
  });

  // Big number
  shapes.push({
    type: "bigNumber",
    id: sid(slideIndex, "big-number"),
    rect: { x: numX, y: 1.3, w: numCols.w, h: 3.2 },
    number: bnContent?.number ?? "0",
    label: bnContent?.label ?? "",
    supporting: bnContent?.supporting,
    numberStyle: {
      fontFamily: fonts.pptxHeading,
      fontSize: 110,
      color: pal.primary,
      bold: true,
      align: numAlign,
      valign: "bottom",
    },
    labelStyle: {
      fontFamily: fonts.pptxBody,
      fontSize: 20,
      color: pal.textMuted,
      align: numAlign,
      valign: "top",
    },
    zIndex: 2,
  });

  // Accent bar
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-2"),
    rect: {
      x: numAlign === "center" ? (CANVAS.W - 3) / 2 : numX,
      y: 4.7,
      w: 3.0,
      h: 0.06,
    },
    fill: { kind: "solid", color: pal.accent },
    cornerRadius: 0.03,
    zIndex: 1,
  });

  // Caption
  if (captionContent?.text) {
    shapes.push({
      type: "text",
      id: sid(slideIndex, "caption"),
      rect: {
        x: numX,
        y: 5.0,
        w: numCols.w,
        h: 1.0,
      },
      runs: [{ text: captionContent.text, fontSize: 16, color: pal.textMuted }],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 16,
        color: pal.textMuted,
        align: numAlign,
        valign: "top",
        lineHeight: 1.5,
      },
      zIndex: 2,
    });
  }

  // Optional image
  if (hasImage) {
    const ig = gridCol(7, 6);
    shapes.push({
      type: "image",
      id: sid(slideIndex, "image"),
      rect: { x: ig.x, y: SAFE_AREA.y + 0.3, w: ig.w, h: SAFE_AREA.h - 0.6 },
      src: imgContent!.src,
      alt: imgContent!.alt ?? "Supporting image",
      objectFit: "cover",
      cornerRadius: ds.shape.radius,
      zIndex: 1,
    });
  }

  return shapes;
}

export const layout: LayoutDefinition = {
  id: "section-bignumber",
  name: "Section — Big Number",
  roles: ["stat", "section"],
  density: "low",
  slots,
  decorations,
  variants: 2,
  buildShapes,
};
