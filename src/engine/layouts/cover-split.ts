/**
 * Engine v2 — Layout: Cover Split
 *
 * Left half: text content. Right half: image.
 * Variants: 0 = image-right, 1 = image-left
 */

import type { Shape, Rect } from "../sceneGraph";
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

function sid(slideIndex: number, name: string): string {
  return `slide-${slideIndex}-${name}`;
}

const textCols = gridCol(1, 6);
const imgCols = gridCol(7, 6);

const slots: Record<string, Slot> = {
  title: {
    kind: "text",
    role: "title",
    rect: { x: textCols.x, y: SAFE_AREA.y + 1.5, w: textCols.w, h: 2.0 },
    minPt: 36,
    maxPt: 52,
    maxChars: 60,
    maxLines: 3,
    align: "left",
    valign: "bottom",
    bold: true,
  },
  subtitle: {
    kind: "text",
    role: "subtitle",
    rect: { x: textCols.x, y: SAFE_AREA.y + 3.7, w: textCols.w, h: 1.2 },
    minPt: 16,
    maxPt: 22,
    maxChars: 120,
    maxLines: 3,
    align: "left",
    valign: "top",
  },
  image: {
    kind: "image",
    rect: { x: imgCols.x, y: 0, w: imgCols.w + CANVAS.SAFE.RIGHT, h: CANVAS.H },
    aspectRatio: (imgCols.w + CANVAS.SAFE.RIGHT) / CANVAS.H,
    objectFit: "cover",
    cornerRadius: 0,
  },
};

function decorations(ds: DesignSystemTokens, _rng: RNG): Shape[] {
  return [
    // Vertical accent line between text and image
    {
      type: "rect" as const,
      id: "deco-vert-line",
      rect: { x: imgCols.x - 0.15, y: SAFE_AREA.y + 0.5, w: 0.05, h: SAFE_AREA.h - 1.0 },
      fill: { kind: "solid" as const, color: ds.palette.accent, opacity: 0.6 },
      cornerRadius: 0.025,
    },
    // Brand badge circle top-left
    {
      type: "rect" as const,
      id: "deco-brand-badge",
      rect: { x: SAFE_AREA.x, y: SAFE_AREA.y, w: 0.5, h: 0.5 },
      fill: { kind: "solid" as const, color: ds.palette.primary },
      cornerRadius: 0.25,
    },
  ];
}

function buildShapes(params: LayoutBuildParams): Shape[] {
  const { ds, slotContent, variant, slideIndex } = params;
  const shapes: Shape[] = [];
  const pal = ds.palette;
  const fonts = ds.fonts;
  const imgRight = variant === 0;

  const txtG = imgRight ? gridCol(1, 6) : gridCol(7, 6);
  const imgG = imgRight ? gridCol(7, 6) : gridCol(1, 6);
  const imgX = imgRight ? imgG.x : 0;
  const imgW = imgRight ? imgG.w + CANVAS.SAFE.RIGHT : imgG.x + imgG.w;
  const txtAlign: "left" | "right" = imgRight ? "left" : "right";

  // Background for text side
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "bg-text-half"),
    rect: {
      x: imgRight ? 0 : imgX + imgW,
      y: 0,
      w: CANVAS.W / 2,
      h: CANVAS.H,
    },
    fill: { kind: "solid", color: pal.bg },
    zIndex: 0,
  });

  // Image
  const imgContent = slotContent["image"] as ImageSlotContent | undefined;
  shapes.push({
    type: "image",
    id: sid(slideIndex, "image"),
    rect: { x: imgX, y: 0, w: imgW, h: CANVAS.H },
    src: imgContent?.src ?? "",
    alt: imgContent?.alt ?? "Cover image",
    objectFit: "cover",
    zIndex: 1,
  });

  // Vertical accent line
  const lineX = imgRight ? imgG.x - 0.15 : imgX + imgW + 0.05;
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-1"),
    rect: { x: lineX, y: SAFE_AREA.y + 0.5, w: 0.05, h: SAFE_AREA.h - 1.0 },
    fill: { kind: "solid", color: pal.accent, opacity: 0.5 },
    cornerRadius: 0.025,
    zIndex: 2,
  });

  // Brand badge
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-2"),
    rect: { x: imgRight ? SAFE_AREA.x : CANVAS.W - SAFE_AREA.x - 0.5, y: SAFE_AREA.y, w: 0.5, h: 0.5 },
    fill: { kind: "solid", color: pal.primary },
    cornerRadius: 0.25,
    zIndex: 5,
  });

  // Title
  const titleContent = slotContent["title"] as TextSlotContent | undefined;
  shapes.push({
    type: "text",
    id: sid(slideIndex, "title"),
    rect: { x: txtG.x, y: SAFE_AREA.y + 1.5, w: txtG.w, h: 2.2 },
    runs: [{ text: titleContent?.text ?? "", bold: true, fontSize: 44, color: pal.text }],
    style: {
      fontFamily: fonts.pptxHeading,
      fontSize: 44,
      color: pal.text,
      bold: true,
      align: txtAlign,
      valign: "bottom",
      lineHeight: 1.1,
    },
    zIndex: 3,
  });

  // Subtitle
  const subtitleContent = slotContent["subtitle"] as TextSlotContent | undefined;
  if (subtitleContent?.text) {
    shapes.push({
      type: "text",
      id: sid(slideIndex, "subtitle"),
      rect: { x: txtG.x, y: SAFE_AREA.y + 3.9, w: txtG.w, h: 1.2 },
      runs: [{ text: subtitleContent.text, fontSize: 18, color: pal.textMuted }],
      style: {
        fontFamily: fonts.pptxBody,
        fontSize: 18,
        color: pal.textMuted,
        align: txtAlign,
        valign: "top",
        lineHeight: 1.5,
      },
      zIndex: 3,
    });
  }

  // Bottom accent bar
  shapes.push({
    type: "rect",
    id: sid(slideIndex, "deco-3"),
    rect: { x: txtG.x, y: SAFE_AREA.y + 3.7, w: 2.0, h: 0.06 },
    fill: { kind: "solid", color: pal.accent },
    cornerRadius: 0.03,
    zIndex: 4,
  });

  return shapes;
}

export const layout: LayoutDefinition = {
  id: "cover-split",
  name: "Cover — Split Image",
  roles: ["cover"],
  density: "low",
  slots,
  decorations,
  variants: 2,
  buildShapes,
};
