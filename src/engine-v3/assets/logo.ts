import fs from "fs";
import path from "path";
import sharp from "sharp";
import { logoPath } from "@/server/uploads";
import type { Asset } from "../types";

/** Copy the uploaded logo into the deck as an asset available to every slide; the designer AI places it. */
export async function addLogoAsset(logoId: string, assetDirPath: string, slides: number[]): Promise<Asset | null> {
  const src = logoPath(logoId);
  if (!src) return null;
  try {
    const file = "logo.png";
    fs.mkdirSync(assetDirPath, { recursive: true });
    fs.copyFileSync(src, path.join(assetDirPath, file));
    const meta = await sharp(src).metadata();
    const st = await sharp(src).flatten({ background: "#ffffff" }).stats();
    const [r, g, b] = st.channels.map((c) => Math.round(c.mean));
    return {
      id: "logo",
      file,
      width: meta.width || 400,
      height: meta.height || 400,
      avgColor: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      mime: "image/png",
      origin: "upload",
      title: "Institution logo",
      description: `the presenter's college/university logo (PNG${meta.hasAlpha ? " with transparent background" : ""}). Put it on the title slide the way an official academic title page would; optional small on other slides; keep its proportions (object-fit: contain), never crop, recolour or stretch it; give it a light plate if the background would hide it`,
      credit: "",
      forSlides: slides,
    } as Asset;
  } catch {
    return null;
  }
}
