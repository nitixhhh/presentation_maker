/**
 * Engine v4 — Mermaid → static, themed SVG on the server (no JavaScript on the slide).
 * Uses the engine's shared headless Chromium (render/browser.ts — no extra browser per call) with the mermaid
 * npm package's browser build; labels are plain SVG <text> (htmlLabels off) so the PDF/PPTX plate shows them.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getBrowser } from "../engine-v3/render/browser";
import { sanitizeSvg } from "./icons/icons";
import type { DesignSystem } from "../engine-v3/types";

let script: string | null = null;
function mermaidScript(): string {
  if (script) return script;
  const cands = [path.join(process.cwd(), "node_modules/mermaid/dist/mermaid.min.js")];
  try {
    cands.push(require.resolve("mermaid/dist/mermaid.min.js"));
  } catch {}
  const f = cands.find((c) => c && fs.existsSync(c));
  if (!f) throw new Error("mermaid is not installed on this server");
  script = fs.readFileSync(f, "utf8");
  return script;
}

const cache = new Map<string, { svg?: string; error?: string }>();

export async function renderMermaid(code: string, opts: { width: number; height: number; design?: Pick<DesignSystem, "palette" | "font"> }): Promise<{ svg?: string; error?: string }> {
  const pal = opts.design?.palette;
  const font = opts.design?.font?.body || "Inter";
  const clean = code.replace(/\r/g, "").replace(/^```(?:mermaid)?\s*|```\s*$/g, "").trim().slice(0, 4000);
  if (/\b(click|callback|href|javascript:|%%\{)/i.test(clean)) return { error: "links, click handlers and init directives are not allowed" };
  const key = crypto.createHash("sha1").update(JSON.stringify([clean, pal, font, opts.width, opts.height])).digest("hex");
  if (cache.has(key)) return cache.get(key)!;
  const theme = {
    background: "transparent",
    fontFamily: `${font}, sans-serif`,
    fontSize: "20px",
    primaryColor: pal?.surface || "#ffffff",
    primaryBorderColor: pal?.primary || "#2563eb",
    primaryTextColor: pal?.ink || "#111827",
    secondaryColor: pal ? `${pal.accent}22` : "#f1f5f9",
    tertiaryColor: pal?.bg || "#ffffff",
    lineColor: pal?.accent || "#f59e0b",
    textColor: pal?.ink || "#111827",
    edgeLabelBackground: pal?.bg || "#ffffff",
    actorBkg: pal?.primary || "#2563eb",
    actorTextColor: pal?.bg || "#ffffff",
    actorBorder: pal?.primary || "#2563eb",
    actorLineColor: pal?.muted || "#64748b",
    signalColor: pal?.accent || "#f59e0b",
    signalTextColor: pal?.ink || "#111827",
    noteBkgColor: pal?.surface || "#fff7d6",
    noteTextColor: pal?.ink || "#111827",
    labelBoxBkgColor: pal?.surface || "#ffffff",
  };
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: Math.max(400, opts.width), height: Math.max(300, opts.height) } });
  const page = await ctx.newPage();
  try {
    await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="c"></div></body></html>`);
    await page.addScriptTag({ content: mermaidScript() });
    const res: { svg?: string; error?: string } = await page.evaluate(
      async ([code, theme]) => {
        try {
          const m = (window as any).mermaid;
          m.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: theme, flowchart: { htmlLabels: false, curve: "basis", padding: 14 }, sequence: { useMaxWidth: true, mirrorActors: false }, htmlLabels: false });
          const { svg } = await m.render("dcm" + Math.random().toString(36).slice(2, 8), code);
          return { svg };
        } catch (e: any) {
          return { error: String(e?.message || e).slice(0, 300) };
        }
      },
      [clean, theme] as const
    );
    if (res.svg) {
      let svg = sanitizeSvg(res.svg)
        .replace(/<svg\b([^>]*)>/, (m, a: string) => `<svg${a.replace(/\s(width|height|style)="[^"]*"/g, "")} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="max-width:100%;max-height:100%;overflow:visible">`);
      if (!/<svg[\s\S]*<\/svg>\s*$/.test(svg.trim())) return { error: "mermaid returned no drawing" };
      svg = svg.trim();
      const out = { svg };
      cache.set(key, out);
      return out;
    }
    return res;
  } catch (e: any) {
    return { error: String(e?.message || e).slice(0, 300) };
  } finally {
    await ctx.close().catch(() => {});
  }
}
