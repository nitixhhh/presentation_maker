/** Engine v3 — Research agent: gathers real sources and extracts cited facts (no invented facts). */
import { chatJson } from "../llm";
import { wikipedia as wikipediaRaw, openalex as openalexRaw, crossref as crossrefRaw, semanticScholar as semanticScholarRaw } from "../research/sources";
import { cached, cacheGet, cacheSet, normTopic } from "../research/cache";

// identical source queries are served from the 7-day research cache (no repeated API calls)
const wikipedia = (q: string, n = 2) => cached("wikipedia", `${q}|${n}`, () => wikipediaRaw(q, n));
const openalex = (q: string, n = 2) => cached("openalex", `${q}|${n}`, () => openalexRaw(q, n));
const crossref = (q: string, n = 2) => cached("crossref", `${q}|${n}`, () => crossrefRaw(q, n));
const semanticScholar = (q: string, n = 2) => cached("s2", `${q}|${n}`, () => semanticScholarRaw(q, n));
import type { Brief, ResearchPack, Source } from "../types";

const SYSTEM = `You are a careful academic research assistant.
You receive numbered SOURCES (Wikipedia extracts and scholarly abstracts). Extract the facts a student presentation on the topic needs.
Strict rules:
- Use ONLY information stated in the sources. Never add numbers, dates, names or claims that are not in them.
- Each fact is one self-contained sentence (max ~30 words) and lists the source ids it came from, e.g. ["S2"].
- Prefer definitions, principles, how-it-works steps, components, applications, advantages, limitations, key numbers (with units), dates, and examples.
- Cover every required section of the brief if the sources allow it. If something important is not in the sources, do not make it up.
- 25–45 facts. Also list up to 10 key terms with one-line meanings (from the sources).
Reply with ONLY JSON: {"facts":[{"id":"F1","text":"","sources":["S1"],"kind":"definition|principle|process|component|application|advantage|limitation|number|history|example"}],"keyTerms":[{"term":"","meaning":""}]}`;

export async function runResearch(brief: Brief, log: (m: string) => void, topic?: string): Promise<ResearchPack> {
  // Same topic, level and sections researched recently → reuse the cited fact pack (no duplicate research).
  const packKey = [normTopic(topic || brief.title), normTopic(brief.level), brief.requiredSections.map(normTopic).join(",")].join("|");
  const hit = cacheGet<ResearchPack>("pack", packKey);
  if (hit && hit.facts?.length >= 12) {
    log(`reusing research for this topic from the cache: ${hit.facts.length} facts, ${hit.sources.length} sources`);
    return hit;
  }
  const pack = await researchFresh(brief, log, topic);
  if (pack.facts.length >= 12) cacheSet("pack", packKey, pack);
  return pack;
}

async function researchFresh(brief: Brief, log: (m: string) => void, topic?: string): Promise<ResearchPack> {
  const queries = brief.researchQueries.slice(0, 4);
  // relevance is judged on the specific topic words, not the broad subject ("Chemistry" would match "Chemistry (band)")
  const STOP = new Set(["introduction", "system", "systems", "using", "based", "study", "management", "analysis", "overview", "presentation", "project", "with", "from", "into", "their", "about", "and", "the", "for"]);
  const topicText = `${topic || ""} ${brief.title}`;
  const topicWords = topicText.toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/).filter((x) => x.length > 2 && !STOP.has(x));
  const offTopic = /\((band|film|album|song|tv series|novel|magazine|video game|company|musician|singer|rapper|group|play|book|surname|given name|disambiguation)\)/i;
  const relevant = (title: string) => !offTopic.test(title) && topicWords.some((w) => title.toLowerCase().includes(w));
  const latin = topicText.replace(/[^\x00-\x7f]+/g, " ").replace(/[()]/g, " ").trim();
  const core = await wikipedia(latin || brief.title, 2);
  // OpenAlex is called one query at a time (its anonymous pool rate-limits bursts)
  let chain: Promise<unknown> = Promise.resolve();
  const oaSerial = (q: string) => {
    const p = chain.then(() => openalex(q, 2));
    chain = p.catch(() => null);
    return p;
  };
  const settled = await Promise.all(
    queries.map(async (q, i) => {
      const [w0, oa, ss] = await Promise.all([
        wikipedia(q, 2),
        i < 3 ? oaSerial(q) : Promise.resolve([]),
        i < 2 ? semanticScholar(q, 2) : Promise.resolve([]),
      ]);
      const phrase = topicWords.slice(0, 2).join(" ");
      const w = w0.filter((p) => relevant(p.title) || (!offTopic.test(p.title) && phrase.length > 3 && p.text.slice(0, 400).toLowerCase().includes(phrase))).slice(0, 1);
      let scholarly = [...oa, ...ss];
      if (!scholarly.length && i === 0) scholarly = await crossref(q, 2);
      return [...w, ...scholarly];
    })
  );
  settled.unshift(core.filter((p) => relevant(p.title)));
  // de-duplicate by title
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const s of settled.flat()) {
    const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ ...s, id: `S${sources.length + 1}` });
    if (sources.length >= 10) break;
  }
  log(`found ${sources.length} sources: ${sources.map((s) => `${s.id} ${s.kind}: ${s.title}`).join(" | ")}`);
  if (!sources.length) {
    return { sources: [], facts: [], keyTerms: [] };
  }

  // Keep the prompt within ~13k tokens so it also fits free models with a 15k tokens/minute limit.
  let budget = 42000;
  const blocks = sources.map((s) => {
    const take = Math.min(s.text.length, s.kind === "wikipedia" ? 5000 : 2000, Math.max(800, budget));
    budget -= take;
    return `[${s.id}] ${s.title} (${s.kind}${s.year ? `, ${s.year}` : ""})\n${s.text.slice(0, take)}`;
  });

  const { data } = await chatJson<{ facts: any[]; keyTerms: any[] }>("research", [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Topic: ${brief.title}\nLevel: ${brief.level}\nDeck type: ${brief.deckType}\nRequired sections: ${brief.requiredSections.join(" → ")}\n\nSOURCES:\n\n${blocks.join("\n\n---\n\n")}`,
    },
  ], { temperature: 0.2, maxTokens: 5000, label: "research" });

  const validIds = new Set(sources.map((s) => s.id));
  const facts = (data.facts || [])
    .filter((f) => f && f.text)
    .map((f, i) => ({
      id: `F${i + 1}`,
      text: String(f.text),
      sources: (Array.isArray(f.sources) ? f.sources : [f.sources]).map(String).filter((x: string) => validIds.has(x)),
      kind: f.kind,
    }))
    .filter((f) => f.sources.length > 0);
  return { sources, facts, keyTerms: (data.keyTerms || []).filter((k: any) => k?.term).slice(0, 12) };
}
