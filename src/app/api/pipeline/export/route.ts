import { NextRequest, NextResponse } from "next/server";
import { emitHtml } from "@/engine/emitters/html";
import { emitPptx } from "@/engine/emitters/pptx";
import { emitPdf } from "@/engine/emitters/pdf";
import { PresentationDeckSchema } from "@/schemas/presentation";
import { generateSlideshowHtml } from "@/lib/export/htmlExport";
import { PptxExporter } from "@/lib/export/pptxExport";
import { PdfExporter } from "@/lib/export/pdfExport";

export async function POST(req: NextRequest) {
  try {
    const { deck, format } = await req.json();

    if (!deck) {
      return NextResponse.json({ error: "Deck is required" }, { status: 400 });
    }

    // ── 1. If Deck is generated with Engine v2 SceneGraph ──
    if (deck.sceneGraph) {
      const topicName = (deck.topic || "presentation").replace(/[^a-z0-9]/gi, "_");

      if (format === "html") {
        const html = deck.htmlContent || emitHtml(deck.sceneGraph);
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(topicName)}.html"`,
          },
        });
      }

      if (format === "pptx") {
        const buffer = await emitPptx(deck.sceneGraph, "editable");
        return new NextResponse(buffer as any, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(topicName)}.pptx"`,
          },
        });
      }

      if (format === "pdf") {
        const html = deck.htmlContent || emitHtml(deck.sceneGraph);
        const pdfBuffer = await emitPdf(html);
        return new NextResponse(pdfBuffer as any, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(topicName)}.pdf"`,
          },
        });
      }
    }

    // ── 2. Fallback to v1 Exporter ──
    const parsedDeck = PresentationDeckSchema.parse(deck);

    if (format === "html") {
      const html = generateSlideshowHtml(parsedDeck);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(parsedDeck.topic)}.html"`,
        },
      });
    }

    if (format === "pptx") {
      const buffer = await PptxExporter.generate(parsedDeck);
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(parsedDeck.topic)}.pptx"`,
        },
      });
    }

    if (format === "pdf") {
      const pdfBuffer = await PdfExporter.generate(parsedDeck);
      return new NextResponse(pdfBuffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(parsedDeck.topic)}.pdf"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Unsupported format. Use 'html', 'pptx', or 'pdf'." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[API /api/pipeline/export Error]:", err);
    return NextResponse.json({ error: err.message || "Export failed" }, { status: 500 });
  }
}
