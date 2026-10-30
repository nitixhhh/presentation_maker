import pptxgen from "pptxgenjs";
import { PresentationDeck } from "@/schemas/presentation";

export class PptxExporter {
  public static async generate(deck: PresentationDeck): Promise<Buffer> {
    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9";

    const { designDna, slides } = deck;
    const { palette, fontPair } = designDna;

    // Helper to strip '#' for pptxgen colors
    const c = (hex: string) => hex.replace("#", "");

    slides.forEach((slideData, idx) => {
      const slide = pres.addSlide();

      // Slide background color
      slide.background = { color: c(palette.background) };

      // Slide Header Badge
      slide.addText(`0${idx + 1} / 0${slides.length}  •  ${deck.topic.toUpperCase()}`, {
        x: 0.8,
        y: 0.5,
        w: 11.5,
        h: 0.4,
        fontSize: 10,
        fontFace: fontPair.bodyFont,
        color: c(palette.mutedText),
        charSpacing: 2,
      });

      // Title
      slide.addText(slideData.title, {
        x: 0.8,
        y: 1.2,
        w: 6.5,
        h: 1.4,
        fontSize: 32,
        fontFace: fontPair.headingFont,
        color: c(palette.text),
        bold: true,
        valign: "top",
      });

      // Subtitle
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.8,
          y: 2.6,
          w: 6.5,
          h: 0.8,
          fontSize: 16,
          fontFace: fontPair.bodyFont,
          color: c(palette.mutedText),
          valign: "top",
        });
      }

      // Bullets
      if (slideData.bodyPoints.length > 0) {
        const bulletObjects = slideData.bodyPoints.map((pt) => ({
          text: pt,
          options: {
            bullet: { type: "round", color: c(palette.primary) },
            fontSize: 15,
            fontFace: fontPair.bodyFont,
            color: c(palette.text),
            breakLine: true,
          },
        }));

        slide.addText(bulletObjects as any, {
          x: 0.8,
          y: 3.5,
          w: 6.5,
          h: 3.0,
          valign: "top",
        });
      }

      // Visual Side Container (Right side: x=7.8, y=1.2, w=4.5, h=5.2)
      const visual = slideData.visualElement;

      // Base background card for visual
      slide.addShape(pres.ShapeType.roundRect, {
        x: 7.8,
        y: 1.2,
        w: 4.6,
        h: 5.2,
        rectRadius: 0.2,
        fill: { color: c(palette.surface) },
        line: { color: c(palette.border), width: 1 },
      });

      if (visual.type === "stat") {
        slide.addText(visual.number, {
          x: 8.0,
          y: 2.2,
          w: 4.2,
          h: 1.5,
          fontSize: 64,
          fontFace: fontPair.headingFont,
          color: c(palette.primary),
          bold: true,
          align: "center",
        });

        slide.addText(visual.label, {
          x: 8.0,
          y: 3.8,
          w: 4.2,
          h: 0.8,
          fontSize: 18,
          fontFace: fontPair.bodyFont,
          color: c(palette.text),
          bold: true,
          align: "center",
        });

        if (visual.supportingText) {
          slide.addText(visual.supportingText, {
            x: 8.0,
            y: 4.6,
            w: 4.2,
            h: 0.8,
            fontSize: 13,
            fontFace: fontPair.bodyFont,
            color: c(palette.mutedText),
            align: "center",
          });
        }
      } else if (visual.type === "cards") {
        visual.items.slice(0, 3).forEach((item, cIdx) => {
          const itemY = 1.5 + cIdx * 1.5;
          slide.addShape(pres.ShapeType.roundRect, {
            x: 8.0,
            y: itemY,
            w: 4.2,
            h: 1.3,
            rectRadius: 0.1,
            fill: { color: c(palette.background) },
            line: { color: c(palette.border), width: 1 },
          });

          slide.addText(item.title, {
            x: 8.2,
            y: itemY + 0.1,
            w: 3.8,
            h: 0.4,
            fontSize: 14,
            fontFace: fontPair.headingFont,
            color: c(palette.secondary),
            bold: true,
          });

          slide.addText(item.description, {
            x: 8.2,
            y: itemY + 0.5,
            w: 3.8,
            h: 0.7,
            fontSize: 11,
            fontFace: fontPair.bodyFont,
            color: c(palette.mutedText),
          });
        });
      } else if (visual.type === "quote") {
        slide.addText(`“${visual.quote}”`, {
          x: 8.1,
          y: 2.2,
          w: 4.0,
          h: 2.2,
          fontSize: 18,
          fontFace: fontPair.headingFont,
          color: c(palette.text),
          italic: true,
          align: "center",
        });

        slide.addText(`— ${visual.author}${visual.role ? ` (${visual.role})` : ""}`, {
          x: 8.1,
          y: 4.6,
          w: 4.0,
          h: 0.6,
          fontSize: 14,
          fontFace: fontPair.bodyFont,
          color: c(palette.secondary),
          bold: true,
          align: "center",
        });
      } else {
        // Fallback visual brand graphic
        slide.addText(`[ ${visual.type.toUpperCase()} COMPONENT ]`, {
          x: 8.0,
          y: 3.2,
          w: 4.2,
          h: 1.0,
          fontSize: 14,
          fontFace: fontPair.headingFont,
          color: c(palette.mutedText),
          align: "center",
        });
      }

      // Speaker Notes
      if (slideData.speakerNotes) {
        slide.addNotes(slideData.speakerNotes);
      }
    });

    const output = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
    return output;
  }
}
