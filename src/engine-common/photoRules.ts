/** Photo relevance rules used by the Standard/Advanced photo vet. */

export const PRODUCT = /\b(headset|oculus|quest ?\d|htc vive|hololens|vision pro|iphone|ipad|smartphone|mobile phone|laptop|macbook|game console|playstation|xbox|nintendo|gamepad|smartwatch|earbuds|headphones?|packaging|product shot|product photo|logo|trademark|advertisement|mockup|stock photo|samsung galaxy|google pixel|microsoft surface|meta quest|amazon echo|virtual reality headset|vr headset)\b/i;
/** a commercial product / gadget / brand picture — unless the slide itself is about that kind of thing */
export function isProductShot(meta: string, slideText: string): boolean {
  const m = PRODUCT.exec(meta || "");
  if (!m) return false;
  const word = m[1].toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  return !(word.length > 2 && new RegExp("\\b" + word, "i").test(slideText || ""));
}
