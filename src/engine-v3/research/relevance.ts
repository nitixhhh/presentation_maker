/**
 * Engine v3 — source relevance filter. Search APIs return pages that merely share a word with the topic
 * ("Supply chain attack" for blockchain in supply chains, "Polygon", a 2009 paper on one grassland's
 * photosynthesis). Students need sources that are ABOUT the topic and that a teacher recognises.
 */
export interface SourceLike {
  kind: string;
  title: string;
  text: string;
  citations?: number;
}

const STOP = new Set([
  "introduction", "system", "systems", "using", "based", "study", "management", "analysis", "overview", "presentation", "project",
  "with", "from", "into", "their", "about", "and", "the", "for", "between", "difference", "differences", "different", "types", "type",
  "explain", "explanation", "examples", "example", "identify", "classify", "what", "how", "role", "importance", "its", "uses", "use",
]);

export const OFF_TOPIC_TITLE = /\((band|film|album|song|tv series|novel|magazine|video game|company|musician|singer|rapper|group|play|book|surname|given name|disambiguation)\)|^list of |in popular culture| attack$|scandal|controversy/i;

export function topicWordsOf(text: string): string[] {
  const words = text.toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/).filter((x) => x.length > 2 && !STOP.has(x));
  return Array.from(new Set(words));
}

const stem = (w: string) => (w.length > 6 ? w.slice(0, Math.max(6, w.length - 4)) : w);
const hits = (hay: string, words: string[]) => words.filter((w) => hay.includes(stem(w))).length;

const OVERVIEW = /(review|overview|introduction|principles?|fundamentals|advances|perspective|handbook|textbook|survey)/i;

/** Is this source about the topic? (title + lead text must carry the topic, its most distinctive word included) */
export function isRelevantSource(s: SourceLike, topicWords: string[]): boolean {
  if (!topicWords.length) return true;
  const title = s.title.toLowerCase();
  if (OFF_TOPIC_TITLE.test(s.title)) return false;
  const lead = `${title} ${String(s.text || "").slice(0, 1500).toLowerCase()}`;
  const need = topicWords.length === 1 ? 1 : topicWords.length === 2 ? 2 : Math.min(3, Math.ceil(topicWords.length * 0.6));
  const key = [...topicWords].sort((a, b) => b.length - a.length)[0]; // the most distinctive word
  if (topicWords.length > 1 && !lead.includes(stem(key))) return false;
  if (hits(lead, topicWords) < need) return false;
  if (s.kind === "wikipedia") return hits(title, topicWords) >= 1;
  // scholarly: the title itself must be about the topic, and niche papers (few citations, narrow case) are skipped
  if (hits(title, topicWords) < Math.min(2, topicWords.length)) return false;
  if (s.citations != null && s.citations < 25 && !OVERVIEW.test(s.title)) return false;
  return true;
}

/** Keep relevant sources; if that leaves fewer than `min`, add back the best-cited scholarly ones that still match the title. */
export function filterSources<T extends SourceLike>(sources: T[], topicWords: string[], min = 3): { kept: T[]; dropped: T[] } {
  const kept = sources.filter((s) => isRelevantSource(s, topicWords));
  const dropped = sources.filter((s) => !kept.includes(s));
  if (kept.length < min) {
    const backups = dropped
      .filter((s) => s.kind !== "wikipedia" && !OFF_TOPIC_TITLE.test(s.title) && hits(s.title.toLowerCase(), topicWords) >= 1)
      .sort((a, b) => (b.citations || 0) - (a.citations || 0));
    for (const b of backups) {
      if (kept.length >= min) break;
      kept.push(b);
      dropped.splice(dropped.indexOf(b), 1);
    }
  }
  return { kept, dropped };
}
