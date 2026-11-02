/**
 * Icon placeholders (Standard/Advanced, and decks saved by the retired v4). Designers write <i class="ic" data-icon="lucide:cpu"></i>; every render
 * (QA, preview, PDF, PPTX) swaps in the real inline SVG while KEEPING the <i> wrapper, so the stored HTML
 * stays compact (the serializer empties the wrapper again) and CSS on the <i> (width/height/color) applies.
 */
import { findIcon, getIcon, searchIcons } from "./icons/icons";

const PLACEHOLDER = /<(i|span)\b([^>]*\bdata-icon\s*=\s*["'][^"']+["'][^>]*)>([\s\S]*?)<\/\1>/gi;

export const ICON_CSS = `
.slide i[data-icon],.slide span[data-icon]{display:inline-flex;align-items:center;justify-content:center;flex:none;font-style:normal;line-height:0;vertical-align:middle;width:var(--ic-size,48px);height:var(--ic-size,48px);color:var(--ic-color,inherit)}
.slide i[data-icon] > svg,.slide span[data-icon] > svg{width:100%;height:100%;display:block;overflow:visible}
`;

function attrs(s: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const m of s.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)) a[m[1].toLowerCase()] = m[2];
  return a;
}

/** the icon record a placeholder resolves to (exact id, else best search hit), or null */
export function resolveIconName(want: string): string | null {
  const r = findIcon(want);
  if (r) return `${r.set}:${r.name}`;
  const hit = searchIcons(want, 1)[0];
  return hit ? hit.id : null;
}

/** Expand every icon placeholder in place (inner SVG). Returns the html plus the icons used / unknown. */
export function expandIcons(html: string): { html: string; used: string[]; missing: string[] } {
  const used: string[] = [];
  const missing: string[] = [];
  if (!/data-icon\s*=/.test(html)) return { html, used, missing };
  html = html.replace(/<(i|span)\b([^>]*\bdata-icon\s*=[^>]*?)\s*\/>/gi, "<$1$2></$1>"); // <i data-icon="x"/> → closed
  const out = html.replace(PLACEHOLDER, (m, tag: string, attrStr: string) => {
    const a = attrs(attrStr);
    const id = resolveIconName(a["data-icon"]);
    if (!id) {
      missing.push(a["data-icon"]);
      return "";
    }
    used.push(id);
    const stroke = a["data-stroke"] ? Number(a["data-stroke"]) : undefined;
    const color = a["data-color"];
    const svg = getIcon(id, { size: "100%" as any, stroke, color: color && /^(#[0-9a-f]{3,8}|var\(--[\w-]+\)|currentColor)$/i.test(color) ? color : undefined, absoluteStroke: false });
    if (!svg) return "";
    // size/colour attributes become CSS variables (author CSS on the <i> still wins)
    const vars: string[] = [];
    if (a["data-size"] && /^\d{1,3}(px)?$/.test(a["data-size"])) vars.push(`--ic-size:${parseInt(a["data-size"], 10)}px`);
    if (color && /^(#[0-9a-f]{3,8}|var\(--[\w-]+\))$/i.test(color)) vars.push(`--ic-color:${color}`);
    let open = `<${tag}${attrStr} data-ic-x="1"`;
    if (vars.length) {
      if (/\bstyle\s*=\s*"/i.test(attrStr)) open = open.replace(/\bstyle\s*=\s*"/i, `style="${vars.join(";")};`);
      else open += ` style="${vars.join(";")}"`;
    }
    return `${open}>${svg.replace(/\swidth="[^"]*"\s+height="[^"]*"/, "")}</${tag}>`;
  });
  return { html: out, used, missing };
}

