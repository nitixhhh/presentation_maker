import fs from "fs";
import path from "path";
import { deckDir } from "@/engine-v3/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  try {
    if (!/^[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(file)) return new Response("bad file", { status: 400 });
    const p = path.join(deckDir(id), "assets", file);
    if (!fs.existsSync(p)) return new Response("not found", { status: 404 });
    const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(fs.readFileSync(p), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response("bad request", { status: 400 });
  }
}
