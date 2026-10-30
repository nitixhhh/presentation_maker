import { benchmarkAuthorized, benchmarkCatalog, listBenchmarks, startBenchmark } from "@/server/benchmark";

function guard(req: Request) {
  const a = benchmarkAuthorized(req);
  if (a === "disabled") return Response.json({ error: "Benchmark is disabled. Set BENCHMARK_PASSWORD in the server env." }, { status: 404 });
  if (a === "denied") return Response.json({ error: "Wrong password." }, { status: 401 });
  return null;
}

export async function GET(req: Request) {
  const g = guard(req);
  if (g) return g;
  return Response.json({ ...benchmarkCatalog(), benchmarks: listBenchmarks() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const g = guard(req);
  if (g) return g;
  try {
    return Response.json({ benchmark: await startBenchmark(await req.json()) });
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
