import fs from "fs";
import { NextRequest } from "next/server";
import { loadDeck } from "@/engine-v3/store";
import { exportPdf } from "@/engine-v3/export/pdf";
import { exportPptx } from "@/engine-v3/export/pptx";
import { deckViewerHtml } from "@/engine-v3/render/document";
import { ensureDeckLocal, exportPath } from "@/server/jobs/manager";


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") || "pdf";
  let deck;
  try {
    await ensureDeckLocal(id);
    deck = loadDeck(id);
  } catch {
    return new Response("bad id", { status: 400 });
  }
  if (!deck) return new Response("not found", { status: 404 });
  const name = deck.brief.title.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60) || "presentation";
  try {
    if (format === "pptx" || format === "pdf") {
      // exports are built once by the background job; rebuild only if missing
      const p = exportPath(id, format);
      const buf = fs.existsSync(p) ? fs.readFileSync(p) : format === "pptx" ? await exportPptx(deck) : await exportPdf(deck);
      const type = format === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/pdf";
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}.${format}"` } });
    }
    if (format === "html") {
      return new Response(deckViewerHtml(deck, `/api/v3/deck/${id}/asset/`), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `${req.nextUrl.searchParams.get("view") ? "inline" : "attachment"}; filename="${name}.html"`,
        },
      });
    }
    return new Response("bad format", { status: 400 });
  } catch (e: any) {
    console.error("[api/v3/export]", e);
    return Response.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
