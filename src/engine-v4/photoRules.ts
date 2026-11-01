/** Engine v4 — photo relevance rules shared by the planner's photo vet and the designer's search_photos. */

export const PRODUCT = /\b(headset|oculus|quest ?\d|htc vive|hololens|vision pro|iphone|ipad|smartphone|mobile phone|laptop|macbook|game console|playstation|xbox|nintendo|gamepad|smartwatch|earbuds|headphones?|packaging|product shot|product photo|logo|trademark|advertisement|mockup|stock photo|samsung galaxy|google pixel|microsoft surface|meta quest|amazon echo|virtual reality headset|vr headset)\b/i;
/** a commercial product / gadget / brand picture — unless the slide itself is about that kind of thing */
export function isProductShot(meta: string, slideText: string): boolean {
  const m = PRODUCT.exec(meta || "");
  if (!m) return false;
  const word = m[1].toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  return !(word.length > 2 && new RegExp("\\b" + word, "i").test(slideText || ""));
}


/** sentences of the planner's internal brief (visual idea, designer note) that ended up on the slide as text */
export function briefLeaks(slideText: string, brief: { visual?: { idea?: string }; designerBrief?: string } | undefined, allowed = ""): string[] {
  if (!brief) return [];
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ");
  const ok = norm(allowed);
  const plain = slideText.toLowerCase().replace(/\s+/g, " ");
  const src = [brief.visual?.idea || "", brief.designerBrief || ""].join(". ");
  const out: string[] = [];
  for (const s of src.split(/(?<=[.!?;:])\s+|\s+[—–-]\s+/)) {
    const words = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    if (words.length < 5) continue;
    // any run of 5 consecutive words from the note found verbatim on the slide
    for (let i = 0; i + 5 <= words.length; i++) {
      const run = words.slice(i, i + 5).join(" ");
      if (!ok.includes(run) && norm(plain).includes(run)) {
        out.push(s.trim().slice(0, 60));
        break;
      }
    }
  }
  return out;
}
