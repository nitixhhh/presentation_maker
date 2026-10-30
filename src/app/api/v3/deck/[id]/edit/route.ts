import { createJob } from "@/server/jobs/manager";
import { resolveOwner } from "@/server/auth";
import { deckAccess } from "@/server/billing";
import { accounts } from "@/server/accounts/store";
import { pricing } from "@/server/pricing";
import { rateLimit, tooMany } from "@/server/rateLimit";

/** Redo one slide with the student's instruction (free edits after unlocking). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]+$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const { ownerKey, user } = await resolveOwner(req);
  if (!rateLimit(`edit:${ownerKey}`, 2, 3)) return tooMany();
  const acc = await deckAccess(id, ownerKey);
  if (!acc?.owner) return Response.json({ error: "not found" }, { status: 404 });
  if (!acc.unlocked) return Response.json({ error: "Unlock the deck to edit it." }, { status: 402 });
  const body = await req.json().catch(() => ({}));
  const n = Number(body?.n);
  const instruction = String(body?.instruction || "").trim().slice(0, 500);
  if (!acc.deck.slides.some((s) => s.n === n)) return Response.json({ error: "Pick a slide." }, { status: 400 });
  if (instruction.length < 4) return Response.json({ error: "Say what should change." }, { status: 400 });
  if ((await accounts().editsUsed(id)) >= pricing().freeEdits) return Response.json({ error: "You have used the free edits for this deck." }, { status: 402 });
  const job = await createJob(acc.deck.request, ownerKey, user?.id, { kind: "edit", edit: { deckId: id, n, instruction } });
  return Response.json({ job }, { status: 202 });
}
