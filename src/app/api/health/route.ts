import { connection } from "next/server";
import { keepAliveState } from "@/server/keepAlive";
import { budgetSnapshot, loadBudget } from "@/engine-v3/assets/imageBudget";

/** Cheap liveness probe (also the in-job keep-alive target). No secrets; no awaited storage reads.
 *  aiImages = today's AI-image count and estimated Cloudflare neurons (of 10,000 free a day), from memory. */
export async function GET() {
  await connection(); // always run at request time (never a prerendered response)
  const aiImages = budgetSnapshot();
  if (!aiImages) void loadBudget().catch(() => undefined); // warm it for the next probe
  return Response.json(
    { ok: true, t: new Date().toISOString(), commit: (process.env.RENDER_GIT_COMMIT || "").slice(0, 7) || undefined, keepAlive: keepAliveState(), aiImages: aiImages || undefined },
    { headers: { "Cache-Control": "no-store" } }
  );
}
