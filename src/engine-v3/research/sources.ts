/** Engine v3 — free academic sources: Wikipedia, OpenAlex, Crossref, Semantic Scholar (optional key). */
import type { Source } from "../types";

const UA = "DeckCraftAI/3.0 (academic presentation engine; contact: deckcraft@example.com)";
const MAILTO = process.env.OPENALEX_MAILTO || "deckcraft@example.com";
/** OpenAlex now gives anonymous users only a tiny shared daily budget — a free key (openalex.org/settings/api) is recommended. */
const OA_KEY = process.env.OPENALEX_API_KEY ? `&api_key=${process.env.OPENALEX_API_KEY}` : "";

async function getJson(url: string, timeoutMs = 12000, headers: Record<string, string> = {}, retries = 1): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: ctrl.signal });
    if (res.status === 429 && retries > 0) {
      const j: any = await res.json().catch(() => ({}));
      const wait = Math.min(Number(j?.retryAfter || res.headers.get("retry-after") || 5), 15);
      clearTimeout(timer);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return getJson(url, timeoutMs, headers, retries - 1);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** Wikipedia: search, then plain-text extract of the best pages. */
export async function wikipedia(query: string, limit = 2, lang = "en"): Promise<Omit<Source, "id">[]> {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const s = await getJson(`${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`);
  const titles: string[] = (s?.query?.search || []).map((r: any) => r.title);
  if (!titles.length) return [];
  // full-text extracts are limited to one page per request → fetch each title separately
  const exs = await Promise.all(
    titles.map((t) =>
      getJson(`${base}?action=query&prop=extracts|info&inprop=url&explaintext=1&exsectionformat=plain&redirects=1&titles=${encodeURIComponent(t)}&format=json&origin=*`)
    )
  );
  const pages = exs.flatMap((ex) => Object.values(ex?.query?.pages || {}) as any[]);
  return pages
    .filter((p) => p.extract && p.extract.length > 400)
    .map((p) => ({
      kind: "wikipedia" as const,
      title: p.title,
      url: p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      venue: "Wikipedia, The Free Encyclopedia",
      text: cleanWiki(p.extract).slice(0, 7000),
      accessed: today(),
    }));
}

function cleanWiki(t: string): string {
  // drop reference-ish tail sections
  const cut = t.search(/\n(See also|References|External links|Further reading|Notes)\n/);
  return (cut > 0 ? t.slice(0, cut) : t).replace(/\n{3,}/g, "\n\n");
}

function abstractFromInverted(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return "";
  const words: string[] = [];
  for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) words[i] = w;
  return words.filter(Boolean).join(" ");
}

/** OpenAlex: scholarly works with abstracts. */
export async function openalex(query: string, limit = 4): Promise<Omit<Source, "id">[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=12&filter=has_abstract:true,type:article|review|book-chapter&sort=relevance_score:desc&mailto=${MAILTO}${OA_KEY}`;
  let j = await getJson(url);
  if (!j?.results) j = await getJson(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=12&filter=has_abstract:true&mailto=${MAILTO}${OA_KEY}`, 15000, {}, 0);
  // keep works whose title matches the query, then prefer well-cited ones (reviews / textbooks first)
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3);
  const results = (j?.results || [])
    .filter((w: any) => {
      const t = String(w.title || "").toLowerCase();
      return words.filter((x) => t.includes(x)).length >= Math.min(2, words.length);
    })
    .sort((a: any, b: any) => (b.cited_by_count || 0) + (b.type === "review" ? 200 : 0) - ((a.cited_by_count || 0) + (a.type === "review" ? 200 : 0)));
  const out: Omit<Source, "id">[] = [];
  for (const w of results) {
    const abs = abstractFromInverted(w.abstract_inverted_index);
    if (!w.title || abs.length < 200) continue;
    out.push({
      kind: "openalex",
      title: w.title.replace(/<[^>]+>/g, ""),
      url: w.doi || w.primary_location?.landing_page_url || w.id,
      doi: w.doi ? w.doi.replace("https://doi.org/", "") : undefined,
      authors: (w.authorships || []).slice(0, 6).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year,
      venue: w.primary_location?.source?.display_name || w.host_venue?.display_name || undefined,
      text: abs.slice(0, 2500),
      accessed: today(),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Crossref: metadata fallback (abstracts are rarer). */
export async function crossref(query: string, limit = 3): Promise<Omit<Source, "id">[]> {
  const j = await getJson(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=20&filter=has-abstract:true,type:journal-article&mailto=${MAILTO}`);
  // prefer overview-type papers that match the query and are cited
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2);
  const score = (it: any) => {
    const t = String(it.title?.[0] || "").toLowerCase();
    return words.filter((w) => t.includes(w)).length * 2 + (/(review|overview|principles?|fundamentals|introduction|applications?|advances)/.test(t) ? 4 : 0) + Math.log10(1 + (it["is-referenced-by-count"] || 0));
  };
  const items = [...(j?.message?.items || [])].sort((a, b) => score(b) - score(a));
  const out: Omit<Source, "id">[] = [];
  for (const it of items) {
    const abs = String(it.abstract || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!it.title?.[0] || abs.length < 200) continue;
    out.push({
      kind: "crossref",
      title: it.title[0],
      url: it.DOI ? `https://doi.org/${it.DOI}` : it.URL,
      doi: it.DOI,
      authors: (it.author || []).slice(0, 6).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")),
      year: it.issued?.["date-parts"]?.[0]?.[0],
      venue: it["container-title"]?.[0],
      text: abs.slice(0, 2500),
      accessed: today(),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Semantic Scholar — only used when SEMANTIC_SCHOLAR_API_KEY is set (anonymous pool is heavily throttled). */
export async function semanticScholar(query: string, limit = 3): Promise<Omit<Source, "id">[]> {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (!key) return [];
  const j = await getJson(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit * 2}&fields=title,abstract,year,authors,venue,externalIds,url`,
    12000,
    { "x-api-key": key }
  );
  return (j?.data || [])
    .filter((p: any) => p.abstract && p.title)
    .slice(0, limit)
    .map((p: any) => ({
      kind: "semanticscholar" as const,
      title: p.title,
      url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : p.url,
      doi: p.externalIds?.DOI,
      authors: (p.authors || []).slice(0, 6).map((a: any) => a.name),
      year: p.year,
      venue: p.venue || undefined,
      text: String(p.abstract).slice(0, 2500),
      accessed: today(),
    }));
}

/** Format one reference in APA 7-like style (deterministic — never written by the LLM). */
export function formatReference(s: Source, style = "APA 7"): string {
  const authors = s.authors?.length ? apaAuthors(s.authors) : "";
  if (s.kind === "wikipedia") {
    const d = new Date(s.accessed);
    const acc = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    let url = s.url;
    try { url = decodeURI(s.url); } catch { /* keep encoded */ }
    return `${s.title}. (n.d.). In Wikipedia, The Free Encyclopedia. Retrieved ${acc}, from ${url}`;
  }
  if (/ieee/i.test(style)) {
    return `${(s.authors || []).slice(0, 3).join(", ")}${(s.authors?.length || 0) > 3 ? " et al." : ""}, "${s.title}," ${s.venue ? `${s.venue}, ` : ""}${s.year || "n.d."}${s.doi ? `, doi: ${s.doi}` : ""}.`;
  }
  return `${authors ? authors + " " : ""}(${s.year || "n.d."}). ${s.title}.${s.venue ? ` ${s.venue}.` : ""}${s.doi ? ` https://doi.org/${s.doi}` : s.url ? ` ${s.url}` : ""}`;
}

function apaAuthors(list: string[]): string {
  const fmt = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const last = parts.pop()!;
    return `${last}, ${parts.map((p) => p[0] + ".").join(" ")}`;
  };
  const a = list.slice(0, 3).map(fmt);
  if (list.length > 3) return `${a.join(", ")}, et al.`;
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(", ")}, & ${a[a.length - 1]}`;
}
