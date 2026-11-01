/**
 * Engine v4 — deeper research. v3's research often ends with 3–4 sources (one Wikipedia page + a filtered paper or two),
 * so slides read thin. This step asks a fast model which specific Wikipedia articles a strong seminar would cite
 * (people, works, experiments, events, technical concepts), fetches the real pages, and extracts more cited facts.
 * Every fact still comes from a fetched page — the model only suggests where to look.
 */
import { chatJson } from "../engine-v3/llm";
import { wikipedia } from "../engine-v3/research/sources";
import type { Brief, ResearchPack, Source } from "../engine-v3/types";

const FACTS_SYSTEM = `You extract facts for a university seminar from the numbered SOURCES below (Wikipedia extracts).
Rules: use ONLY what the sources state; never add numbers, dates or names that are not in them. Each fact is one self-contained sentence (max ~30 words) with specific substance — names, years, numbers with units, mechanisms, results, examples — and lists its source ids, e.g. ["S5"]. Only facts that matter for the TOPIC. 12–24 facts.
Reply with ONLY JSON: {"facts":[{"text":"","sources":["S5"],"kind":"definition|principle|process|component|application|advantage|limitation|number|history|example"}]}`;

export async function deepenResearch(brief: Brief, pack: ResearchPack, topic: string, log: (m: string) => void): Promise<ResearchPack> {
  if (pack.sources.length >= 8 && pack.facts.length >= 35) return pack;
  try {
    const have = pack.sources.map((s) => s.title).join("; ");
    const { data } = await chatJson<{ titles: string[] }>(
      "brief",
      [
        {
          role: "user",
          content: `Topic of a ${brief.level || "university"} ${brief.deckType || "seminar"} presentation: "${topic}" (${brief.title}).\nAlready read: ${have || "nothing"}.\nList 7 specific English Wikipedia article titles that a strong presentation on exactly this topic would draw facts from — key people, original papers/works, experiments, events, mechanisms, real-world applications or criticisms. Exact article titles, no disambiguation pages, nothing already read.\nReply ONLY JSON: {"titles":["..."]}`,
        },
      ],
      { temperature: 0.2, maxTokens: 400, timeoutMs: 40_000, label: "v4 research leads" }
    );
    const want = (Array.isArray(data?.titles) ? data.titles : []).map(String).filter(Boolean).slice(0, 7);
    if (!want.length) return pack;
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
    if (!fresh.length) return pack;
    const base = pack.sources.length;
    const sources: Source[] = fresh.map((s, i) => ({ ...s, id: `S${base + i + 1}` }));
    const blocks = sources.map((s) => `[${s.id}] ${s.title}\n${s.text.slice(0, 3500)}`).join("\n\n---\n\n");
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
