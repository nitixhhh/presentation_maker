import { getJobView } from "@/server/jobs/manager";


export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const job = await getJobView(id);
  if (!job) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ job }, { headers: { "Cache-Control": "no-store" } });
}
