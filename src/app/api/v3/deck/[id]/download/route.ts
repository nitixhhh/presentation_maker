import { NextRequest } from "next/server";
import { deckBuilding, ensureDeckLocal, STILL_BUILDING_MESSAGE } from "@/server/jobs/manager";
import { deckIncomplete, loadDeck } from "@/engine-v3/store";
import { resolveOwner } from "@/server/auth";
import { deckAccess } from "@/server/billing";
import { deckToken } from "@/server/deckAuth";

/** Returns a 5-minute signed link to the clean file — only for the owner of an unlocked deck. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") || "pdf";
  if (!/^[a-z0-9-]+$/i.test(id) || !["pdf", "pptx", "notes", "html"].includes(format)) return Response.json({ error: "bad request" }, { status: 400 });
  await ensureDeckLocal(id);
  const { ownerKey } = await resolveOwner(req);
  const acc = await deckAccess(id, ownerKey);
  if (!acc?.owner) return Response.json({ error: "not found" }, { status: 404 });
  // a deck that is still being made has no finished file yet: say so instead of serving an empty export
  const deck = loadDeck(id);
  if (deckBuilding(id) || (deck && deckIncomplete(deck))) return Response.json({ error: STILL_BUILDING_MESSAGE, building: true }, { status: 409 });
  if (!acc.unlocked) return Response.json({ error: "Unlock this deck to download it." }, { status: 402 });
  const t = deckToken(id, "full", 300);
  return Response.json({ url: `/api/v3/deck/${id}/export?format=${format}${format === "html" ? "&view=1" : ""}&t=${encodeURIComponent(t)}` });
}
