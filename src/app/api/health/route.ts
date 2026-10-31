import { connection } from "next/server";
import { keepAliveState } from "@/server/keepAlive";

/** Cheap liveness probe (also the in-job keep-alive target). No secrets, no storage reads. */
export async function GET() {
  await connection(); // always run at request time (never a prerendered response)
  return Response.json({ ok: true, t: new Date().toISOString(), keepAlive: keepAliveState() }, { headers: { "Cache-Control": "no-store" } });
}
