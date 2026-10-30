import fs from "fs";
import { ensureDeckLocal, previewPath, buildPreviews } from "@/server/jobs/manager";


/** Slide preview as a JPEG (fast on phones; exactly what Chromium rendered). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const num = Number(n);
  if (!/^[a-z0-9-]+$/i.test(id) || !Number.isInteger(num) || num < 1 || num > 60) return new Response("bad request", { status: 400 });
  try {
    if (!(await ensureDeckLocal(id))) return new Response("not found", { status: 404 });
    let p = previewPath(id, num);
    if (!fs.existsSync(p)) {
      await buildPreviews(id); // decks made before previews existed
      p = previewPath(id, num);
    }
    if (!fs.existsSync(p)) return new Response("not found", { status: 404 });
    return new Response(new Uint8Array(fs.readFileSync(p)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("bad request", { status: 400 });
  }
}
