import { benchmarkAuthorized, benchmarkResult } from "@/server/benchmark";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = benchmarkAuthorized(req);
  if (a !== "ok") return Response.json({ error: a === "disabled" ? "disabled" : "Wrong password." }, { status: a === "disabled" ? 404 : 401 });
  const { id } = await params;
  const r = await benchmarkResult(id);
  if (!r) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
