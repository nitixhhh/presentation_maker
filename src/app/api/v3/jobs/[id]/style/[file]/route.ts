import fs from "fs";
import { hasStylePreviewToken, stylePreviewFile } from "@/server/jobs/v6";

/** Engine v6 style step: a preview image of this deck in one proposed style (signed link from the job view). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!/^[a-z0-9-]{6,64}$/i.test(id)) return new Response("bad id", { status: 400 });
  if (!hasStylePreviewToken(new URL(req.url).searchParams.get("t") || "", id)) return new Response("forbidden", { status: 403 });
  const f = await stylePreviewFile(id, file).catch(() => null);
  if (!f) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(f)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
