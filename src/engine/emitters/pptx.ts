/**
 * Engine v2 — PPTX Emitter
 * Converts SceneGraph → PPTX using pptxgenjs with native shapes.
 * Uses PPTX-safe fonts for reliable cross-platform rendering.
 */

import pptxgen from "pptxgenjs";
import type { SceneGraph, SceneGraphSlide, Shape, Fill, TextStyle } from "../sceneGraph";

/** Strip '#' prefix for pptxgen color values */
const c = (hex: string): string => hex.replace("#", "");

function fillToPptx(fill: Fill): Record<string, unknown> | undefined {
  if (fill.kind === "solid") return { color: c(fill.color), transparency: fill.opacity !== undefined ? Math.round((1 - fill.opacity) * 100) : 0 };
  if (fill.kind === "gradient") {
    // pptxgenjs gradient support is limited; use first stop as solid fallback
    return { color: c(fill.stops[0]?.color || "000000") };
  }
  return undefined;
}

/** Convert scene graph to PPTX buffer */
export async function emitPptx(
  sg: SceneGraph,
  mode: "editable" | "exact" = "editable"
): Promise<Buffer> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";

  const ds = sg.designSystem;
  // Use PPTX-safe fonts
  const headFont = ds.fonts.pptxHeading;
  const bodyFont = ds.fonts.pptxBody;

  for (const slideData of sg.slides) {
    const slide = pres.addSlide();

    // Background
    if (slideData.background.kind === "solid") {
      slide.background = { color: c(slideData.background.color) };
    } else if (slideData.background.kind === "gradient" && slideData.background.stops.length > 0) {
      slide.background = { color: c(slideData.background.stops[0].color) };
    }

    // Sort shapes by zIndex
    const sortedShapes = [...slideData.shapes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    for (const shape of sortedShapes) {
      try {
        renderShapeToPptx(slide, pres, shape, headFont, bodyFont, ds);
      } catch (err) {
        console.warn(`[PPTX Emitter] Skipping shape ${shape.id}: ${(err as Error).message}`);
      }
    }

    // Speaker notes
    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }
  }

  return (await pres.write({ outputType: "nodebuffer" })) as Buffer;
}

function renderShapeToPptx(
  slide: pptxgen.Slide,
  pres: pptxgen,
  shape: Shape,
  headFont: string,
  bodyFont: string,
  ds: SceneGraph["designSystem"]
): void {
  const { x, y, w, h } = shape.rect;

  switch (shape.type) {
    case "rect": {
      const opts: Record<string, unknown> = { x, y, w, h };
      const fill = fillToPptx(shape.fill);
      if (fill) opts.fill = fill;
      if (shape.cornerRadius) opts.rectRadius = Math.min(shape.cornerRadius / 100, 0.5);
      if (shape.stroke) opts.line = { color: c(shape.stroke.color), width: shape.stroke.width };
      slide.addShape(pres.ShapeType.roundRect, opts as pptxgen.ShapeProps);
      break;
    }

    case "text": {
      const font = shape.style.fontFamily.includes("heading") ? headFont : bodyFont;
      const text = shape.runs.map((r) => r.text).join("");
      slide.addText(text, {
        x, y, w, h,
        fontSize: shape.style.fontSize,
        fontFace: font,
        color: c(shape.style.color),
        bold: shape.style.bold || false,
        italic: shape.style.italic || false,
        align: shape.style.align || "left",
        valign: shape.style.valign || "top",
        charSpacing: shape.style.charSpacing,
      });
      break;
    }

    case "bulletList": {
      const bulletObjs = shape.items.map((item) => ({
        text: item,
        options: {
          bullet: shape.bulletStyle === "number"
            ? { type: "number" as const }
            : { type: "bullet" as const, color: c(shape.bulletColor) },
          fontSize: shape.style.fontSize,
          fontFace: bodyFont,
          color: c(shape.style.color),
          breakLine: true,
          paraSpaceAfter: Math.round((shape.itemSpacing || 0.2) * 14),
        },
      }));
      slide.addText(bulletObjs as pptxgen.TextProps[], { x, y, w, h, valign: "top" });
      break;
    }

    case "image": {
      if (shape.src.startsWith("fixture://")) {
        // Placeholder for fixture images — draw a colored rect with label
        slide.addShape(pres.ShapeType.roundRect, {
          x, y, w, h,
          fill: { color: c(ds.palette.bgAlt) },
          rectRadius: shape.cornerRadius ? Math.min(shape.cornerRadius / 100, 0.3) : 0,
          line: { color: c(ds.palette.textMuted), width: 0.5 },
        } as pptxgen.ShapeProps);
        slide.addText(`[Image: ${shape.alt}]`, {
          x, y, w, h,
          fontSize: 11,
          fontFace: bodyFont,
          color: c(ds.palette.textMuted),
          align: "center",
          valign: "middle",
        });
      } else if (shape.src.startsWith("data:")) {
        slide.addImage({ data: shape.src, x, y, w, h });
      } else {
        try { slide.addImage({ path: shape.src, x, y, w, h }); } catch { /* skip missing */ }
      }
      break;
    }

    case "bigNumber": {
      const numFont = headFont;
      slide.addText(shape.number, {
        x, y, w, h: h * 0.55,
        fontSize: shape.numberStyle.fontSize,
        fontFace: numFont,
        color: c(shape.numberStyle.color),
        bold: true,
        align: "center",
        valign: "bottom",
      });
      slide.addText(shape.label, {
        x, y: y + h * 0.55, w, h: h * 0.25,
        fontSize: shape.labelStyle.fontSize,
        fontFace: bodyFont,
        color: c(shape.labelStyle.color),
        bold: true,
        align: "center",
        valign: "top",
      });
      if (shape.supporting) {
        slide.addText(shape.supporting, {
          x, y: y + h * 0.8, w, h: h * 0.2,
          fontSize: 11,
          fontFace: bodyFont,
          color: c(ds.palette.textMuted),
          align: "center",
          valign: "top",
        });
      }
      break;
    }

    case "icon": {
      // Placeholder: circle with icon name
      slide.addShape(pres.ShapeType.ellipse, {
        x, y, w: Math.min(w, h), h: Math.min(w, h),
        fill: { color: c(ds.palette.primary), transparency: 85 },
      } as pptxgen.ShapeProps);
      slide.addText(shape.iconName, {
        x, y, w, h,
        fontSize: 9,
        fontFace: bodyFont,
        color: c(shape.color),
        align: "center",
        valign: "middle",
      });
      break;
    }

    case "chart": {
      if (shape.chartPng) {
        const data = shape.chartPng.startsWith("data:") ? shape.chartPng : `data:image/png;base64,${shape.chartPng}`;
        slide.addImage({ data, x, y, w, h });
      }
      break;
    }

    case "diagram": {
      if (shape.renderedPng) {
        const data = shape.renderedPng.startsWith("data:") ? shape.renderedPng : `data:image/png;base64,${shape.renderedPng}`;
        slide.addImage({ data, x, y, w, h });
      } else {
        slide.addText(`[${shape.diagramKind} diagram]`, {
          x, y, w, h,
          fontSize: 12,
          fontFace: bodyFont,
          color: c(ds.palette.textMuted),
          align: "center",
          valign: "middle",
        });
      }
      break;
    }
  }
}

