import { saveLogo } from "@/server/uploads";
import { resolveOwner } from "@/server/auth";
import { rateLimit, tooMany } from "@/server/rateLimit";

/** Upload the college/university logo (multipart form field "file", max 3 MB). */
export async function POST(req: Request) {
  const { ownerKey } = await resolveOwner(req);
  if (!rateLimit(`upload:${ownerKey}`, 6)) return tooMany();
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!f || typeof f === "string") return Response.json({ error: "No file." }, { status: 400 });
    if (f.size > 3 * 1024 * 1024) return Response.json({ error: "The logo must be under 3 MB." }, { status: 400 });
    const id = await saveLogo(Buffer.from(await f.arrayBuffer()));
    return Response.json({ id });
  } catch (e: any) {
    return Response.json({ error: /PNG|JPG/.test(String(e?.message)) ? e.message : "That file is not an image we can read." }, { status: 400 });
  }
}
