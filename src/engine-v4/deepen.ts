/**
 * Engine v4 — deeper research. v3's research often ends with 3–4 sources (one Wikipedia page + a filtered paper or two),
 * so slides read thin. This step asks a fast model which specific Wikipedia articles a strong seminar would cite
 * (people, works, experiments, events, technical concepts), fetches the real pages, and extracts more cited facts.
 * Every fact still comes from a fetched page — the model only suggests where to look.
 */
import { chatJson } from "../engine-v3/llm";
import { wikipedia, openalex, crossref } from "../engine-v3/research/sources";
import { topicWordsOf, OFF_TOPIC_TITLE } from "../engine-v3/research/relevance";
import type { Brief, ResearchPack, Source } from "../engine-v3/types";

export const FACTS_SYSTEM = `You extract facts for a university seminar from the numbered SOURCES below (Wikipedia extracts and scholarly abstracts).
Rules: use ONLY what the sources state; never add numbers, dates or names that are not in them. Each fact is one self-contained sentence (max ~30 words) with specific substance — names, years, numbers with units, mechanisms, results, examples — and lists its source ids, e.g. ["S5"]. Only facts that matter for the TOPIC. 12–24 facts, including at least 2 from every scholarly abstract (kind paper) when it states something relevant.
Reply with ONLY JSON: {"facts":[{"text":"","sources":["S5"],"kind":"definition|principle|process|component|application|advantage|limitation|number|history|example"}]}`;

const UA = "DeckCraftAI/4.0 (academic presentation engine; contact: deckcraft@example.com)";
async function fetchText(url: string, ms = 12000, accept = "application/json"): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: ctrl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
const today = () => new Date().toISOString().slice(0, 10);
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** arXiv (physics, CS, maths): abstracts, free, no key */
async function arxiv(query: string, limit = 3): Promise<Omit<Source, "id">[]> {
  const q = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  const xml = await fetchText(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:"${q}"`)}&max_results=${limit * 2}&sortBy=relevance`, 15000, "application/atom+xml");
  if (!xml) return [];
  const out: Omit<Source, "id">[] = [];
  for (const e of xml.split("<entry>").slice(1)) {
    const title = decode(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1] || "");
    const abs = decode(/<summary>([\s\S]*?)<\/summary>/.exec(e)?.[1] || "");
    const id = /<id>([\s\S]*?)<\/id>/.exec(e)?.[1]?.trim() || "";
    const year = Number(/<published>(\d{4})/.exec(e)?.[1]) || undefined;
    const authors = [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => decode(m[1])).slice(0, 6);
    const doi = /<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/.exec(e)?.[1]?.trim();
    const venue = decode(/<arxiv:journal_ref[^>]*>([\s\S]*?)<\/arxiv:journal_ref>/.exec(e)?.[1] || "") || "arXiv preprint";
    if (!title || abs.length < 200) continue;
    out.push({ kind: "openalex" as const, title, url: id.replace(/^http:/, "https:").replace(/v\d+$/, ""), doi, authors, year, venue, text: abs.slice(0, 2500), accessed: today() });
    if (out.length >= limit) break;
  }
  return out;
}

/** Europe PMC (medicine, biology, health): peer-reviewed abstracts, free, no key */
async function europePmc(query: string, limit = 3): Promise<Omit<Source, "id">[]> {
  const txt = await fetchText(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`${query} AND HAS_ABSTRACT:Y AND SRC:MED`)}&format=json&pageSize=${limit * 3}&resultType=core`, 15000);
  if (!txt) return [];
  let j: any;
  try {
    j = JSON.parse(txt);
  } catch {
    return [];
  }
  const out: Omit<Source, "id">[] = [];
  for (const r of j?.resultList?.result || []) {
    const abs = decode(String(r.abstractText || ""));
    if (!r.title || abs.length < 200) continue;
    out.push({
      kind: "openalex" as const,
      title: decode(String(r.title)).replace(/\.$/, ""),
      url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
      doi: r.doi,
      authors: String(r.authorString || "").split(/,\s*/).filter(Boolean).slice(0, 6),
      year: Number(r.pubYear) || undefined,
      venue: r.journalInfo?.journal?.title || r.journalTitle,
      text: abs.slice(0, 2500),
      accessed: today(),
      citations: typeof r.citedByCount === "number" ? r.citedByCount : undefined,
    });
  }
  return out.sort((a, b) => (b.citations || 0) - (a.citations || 0)).slice(0, limit);
}

/**
 * At least one credible non-Wikipedia source per deck: when research kept only Wikipedia pages, look for on-topic
 * peer-reviewed or preprint papers (OpenAlex, arXiv, Europe PMC, Crossref) whose TITLE is about the topic. Their
 * abstracts go through the same fact extraction, so every fact still comes from a fetched text.
 */
export async function scholarlySources(brief: Brief, topic: string, have: Source[], wantWorks: string[] = []): Promise<Omit<Source, "id">[]> {
  if (have.some((s) => s.kind !== "wikipedia")) return [];
  const QW = new Set(["are", "was", "were", "can", "does", "did", "why", "who", "our", "you", "your", "we", "living", "really", "how", "what", "will", "should", "could", "would", "this", "that", "these", "those", "into", "versus"]);
  const words = topicWordsOf(`${topic} ${brief.title}`.replace(/[^\x00-\x7f]+/g, " ")).filter((w) => !QW.has(w));
  if (!words.length) return [];
  const stem = (w: string) => (w.length > 6 ? w.slice(0, Math.max(6, w.length - 4)) : w);
  const titleHits = (t: string) => words.filter((w) => t.toLowerCase().includes(stem(w))).length;
  const need = Math.min(2, words.length);
  const queries = Array.from(new Set([`${topic}`.replace(/[^\x00-\x7f]+/g, " ").replace(/[?!.]/g, " ").trim(), ...brief.researchQueries.slice(0, 2), ...wantWorks.slice(0, 3)].filter((q) => q && q.length > 3)));
  const lists = await Promise.all(
    queries.slice(0, 4).flatMap((q) => [openalex(q, 4).catch(() => []), arxiv(q, 3).catch(() => []), europePmc(q, 3).catch(() => [])])
  );
  const key = [...words].sort((a, b) => b.length - a.length)[0];
  const onTopic = (t: string) => t.toLowerCase().includes(stem(key)) && titleHits(t) >= need;
  let cands = lists.flat().filter((s) => s.title && !OFF_TOPIC_TITLE.test(s.title) && onTopic(s.title) && (s.text || "").length >= 200);
  if (!cands.length) cands = (await crossref(queries[0], 3).catch(() => [])).filter((s) => onTopic(s.title));
  const seen = new Set(have.map((s) => s.title.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const out: Omit<Source, "id">[] = [];
  // peer-reviewed first (a journal venue), then more cited, then preprints
  cands.sort((a, b) => Number(!!b.venue && !/arxiv/i.test(String(b.venue))) - Number(!!a.venue && !/arxiv/i.test(String(a.venue))) || (b.citations || 0) - (a.citations || 0));
  for (const s of cands) {
    const k = s.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 2) break;
  }
  return out;
}

export async function deepenResearch(brief: Brief, pack: ResearchPack, topic: string, log: (m: string) => void): Promise<ResearchPack> {
  const onlyWiki = !pack.sources.some((s) => s.kind !== "wikipedia");
  if (pack.sources.length >= 8 && pack.facts.length >= 35 && !onlyWiki) return pack;
  try {
    const have = pack.sources.map((s) => s.title).join("; ");
    const { data } = await chatJson<{ titles: string[]; papers?: string[] }>(
      "brief",
      [
        {
          role: "user",
          content: `Topic of a ${brief.level || "university"} ${brief.deckType || "seminar"} presentation: "${topic}" (${brief.title}).\nAlready read: ${have || "nothing"}.\nList 7 specific English Wikipedia article titles that a strong presentation on exactly this topic would draw facts from — key people, original papers/works, experiments, events, mechanisms, real-world applications or criticisms. Exact article titles, no disambiguation pages, nothing already read.\nAlso list up to 3 short English search phrases (3–6 words) for peer-reviewed papers or well-known scholarly works on exactly this topic (e.g. an original paper's title words).\nReply ONLY JSON: {"titles":["..."],"papers":["..."]}`,
        },
      ],
      { temperature: 0.2, maxTokens: 400, timeoutMs: 40_000, label: "v4 research leads" }
    );
    const want = (Array.isArray(data?.titles) ? data.titles : []).map(String).filter(Boolean).slice(0, 7);
    const papers = (Array.isArray(data?.papers) ? data.papers : []).map(String).filter((x) => x.length > 3).slice(0, 3);
    // credible non-Wikipedia sources (papers) in parallel with the Wikipedia pages
    const scholarlyP = onlyWiki ? scholarlySources(brief, topic, pack.sources, papers).catch(() => []) : Promise.resolve([] as Omit<Source, "id">[]);
    if (!want.length && !onlyWiki) return pack;
    const seen = new Set(pack.sources.map((s) => s.title.toLowerCase().replace(/[^a-z0-9]/g, "")));
    const offTopic = /\((band|film|album|song|tv series|novel|magazine|video game|musician|singer|rapper|group|play|surname|given name|disambiguation)\)/i;
    const pages = (await Promise.all(want.map((t) => wikipedia(t, 1).catch(() => [])))).flat();
    const fresh: Omit<Source, "id">[] = [];
    for (const pg of pages) {
      const k = pg.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(k) || offTopic.test(pg.title) || (pg.text || "").length < 400 || /may refer to/i.test(pg.text.slice(0, 300))) continue;
      seen.add(k);
      fresh.push(pg);
      if (fresh.length >= 5) break;
    }
    const scholarly = await scholarlyP;
    if (scholarly.length) log(`credible sources beyond Wikipedia: ${scholarly.map((s) => `${s.title.slice(0, 60)} (${s.venue || "paper"}${s.year ? `, ${s.year}` : ""})`).join(" | ")}`);
    else if (onlyWiki) log("no on-topic paper with an abstract was found — the deck cites Wikipedia only");
    fresh.push(...scholarly);
    if (!fresh.length) return pack;
    const base = pack.sources.length;
    const sources: Source[] = fresh.map((s, i) => ({ ...s, id: `S${base + i + 1}` }));
    const blocks = sources.map((s) => `[${s.id}]${s.kind === "wikipedia" ? "" : " (paper)"} ${s.title}${s.kind === "wikipedia" ? "" : ` — ${(s.authors || []).slice(0, 2).join(", ")}${s.year ? ` (${s.year})` : ""}${s.venue ? `, ${s.venue}` : ""}`}\n${s.text.slice(0, 3500)}`).join("\n\n---\n\n");
    const r = await chatJson<{ facts: any[] }>("research", [{ role: "system", content: FACTS_SYSTEM }, { role: "user", content: `TOPIC: ${brief.title}\n\nSOURCES:\n\n${blocks}` }], { temperature: 0.2, maxTokens: 4000, timeoutMs: 90_000, label: "v4 research facts" });
    const ids = new Set(sources.map((s) => s.id));
    let next = pack.facts.length;
    const facts = (r.data?.facts || [])
      .filter((f: any) => f?.text)
      .map((f: any) => ({ id: `F${++next}`, text: String(f.text), sources: (Array.isArray(f.sources) ? f.sources : [f.sources]).map(String).filter((x: string) => ids.has(x)), kind: f.kind }))
      .filter((f: any) => f.sources.length);
    // only keep the new sources that a fact actually came from
    const used = new Set(facts.flatMap((f: any) => f.sources));
    const keep = sources.filter((s) => used.has(s.id));
    log(`deeper research: +${keep.length} sources (${keep.map((s) => s.title).join(" | ")}), +${facts.length} cited facts`);
    return { ...pack, sources: [...pack.sources, ...keep], facts: [...pack.facts, ...facts] };
  } catch (e: any) {
    log(`deeper research skipped (${String(e?.message || e).slice(0, 80)})`);
    return pack;
  }
}
