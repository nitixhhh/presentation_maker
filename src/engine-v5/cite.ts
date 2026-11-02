/**
 * Engine v5 — citations for the references slide. Sources are written the way a student would cite them in a
 * report — author, year, title, publisher / journal / site — never as bare links. The links stay available to the
 * presenter in the references slide's speaker notes, so every fact can still be checked.
 */
import type { Fact, Source } from "../engine-v3/types";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Roland Bénabou" → "Bénabou, R."; duplicates (same person listed twice by the index) are dropped */
export function citeAuthors(list: string[] = []): string {
  const seen = new Set<string>();
  const names = list.map((n) => String(n || "").replace(/\s+/g, " ").trim()).filter((n) => {
    const k = n.toLowerCase().normalize("NFKD").replace(/[^\p{L} ]/gu, "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const fmt = (n: string) => {
    const parts = n.replace(/\./g, " ").split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    // "Roland Bénabou" → surname last; "Patel H" / "H P"-style index names → the longest word is the surname
    let si = parts.length - 1;
    if (parts[si].length <= 2) {
      const longest = parts.reduce((b, p, i) => (p.length > parts[b].length ? i : b), 0);
      if (parts[longest].length > 2) si = longest;
    }
    const sur = parts[si];
    const given = parts.filter((_, i) => i !== si);
    return `${sur}, ${given.map((p) => p[0].toUpperCase() + ".").join(" ")}`;
  };
  const all = [...new Set(names.map(fmt))];
  const a = all.slice(0, 3);
  if (!a.length) return "";
  if (all.length > 3) return `${a.join(", ")}, et al.`;
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(", ")} & ${a[a.length - 1]}`;
}

function siteName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (/wikipedia\.org$/.test(h)) return "Wikipedia";
    if (/britannica\.com$/.test(h)) return "Encyclopaedia Britannica";
    if (/nasa\.gov$/.test(h)) return "NASA";
    if (/arxiv\.org$/.test(h)) return "arXiv";
    return h;
  } catch {
    return "";
  }
}

/** one citation in plain words: no URL, no DOI link (the DOI is in the notes) */
export function citeSource(s: Source, lang = "English"): string {
  const hi = /hindi/i.test(lang);
  const title = String(s.title || "").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  if (s.kind === "wikipedia") {
    const d = new Date(s.accessed || Date.now());
    const acc = `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return hi ? `“${title}”. विकिपीडिया (देखा गया ${acc}).` : `“${title}.” Wikipedia, The Free Encyclopedia (accessed ${acc}).`;
  }
  const authors = citeAuthors(s.authors);
  const year = s.year ? String(s.year) : "n.d.";
  const venue = String(s.venue || "").trim() || siteName(s.url);
  return `${authors ? `${authors} ` : ""}(${year}). ${title}.${venue ? ` ${venue}.` : ""}`.replace(/\.\./g, ".");
}

/** the link behind a citation (DOI first), for the presenter's notes */
export function sourceLink(s: Source): string {
  if (s.doi) return `https://doi.org/${String(s.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`;
  return s.url || "";
}

const STOP = new Set("the a an and or of in on to for by with from as at is are was were be been that this these those it its their his her than more most less into over under between during while which who whom whose what when where how why not no but also has have had per via about after before since until such each other only own same so very can will would should could may might one two three".split(" "));
const words = (t: string) => String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}%.\s-]/gu, " ").split(/\s+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter((w) => w.length > 2 && !STOP.has(w));
// distinctive numbers only (32.5%, 2.3, 1989, 68998) — "1%" or "10" appear in too many facts to identify one
const numbers = (t: string) => (String(t || "").match(/\d[\d,]*(?:\.\d+)?%?/g) || []).map((n) => n.replace(/,/g, "")).filter((n) => /\./.test(n) || n.replace(/%/, "").length >= 3);

/**
 * The facts a slide's text actually uses, for a slide the planner left without fact ids — so a number on a
 * stats slide still credits the source it came from. A fact counts when it shares a real number with the slide
 * (32.5%, 1989, 0.63) plus a word, or most of its content words.
 */
export function inferFactIds(slideText: string, facts: Fact[]): string[] {
  const sw = new Set(words(slideText));
  const sn = new Set(numbers(slideText));
  const out: { id: string; score: number }[] = [];
  for (const f of facts) {
    const fw = [...new Set(words(f.text))];
    if (!fw.length) continue;
    const shared = fw.filter((w) => sw.has(w)).length;
    const nums = numbers(f.text).filter((n) => sn.has(n) && !/^(19|20)\d\d$/.test(n.replace(/%/, ""))).length;
    const years = numbers(f.text).filter((n) => sn.has(n) && /^(19|20)\d\d$/.test(n)).length;
    const score = nums * 3 + years + shared / fw.length * 4;
    if ((nums >= 1 && shared >= 2) || (years >= 2 && shared >= 2) || (fw.length >= 5 && shared / fw.length >= 0.6)) out.push({ id: f.id, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.id);
}

export interface V5Reference { n: number; sourceId: string; sourceIds: string[]; text: string; url: string; urls: string[]; kind: string }

/**
 * The references list, numbered by first use. Papers are listed one by one. Encyclopedia articles are listed one by
 * one only when there are one or two of them; three or more become ONE entry naming every article ("Wikipedia, The
 * Free Encyclopedia — articles “A”, “B”, “C”"), so the slide reads as a source list led by papers instead of a column
 * of Wikipedia lines, while every article used is still named (and linked in the notes).
 */
export function buildReferences(order: string[], sources: Source[], lang = "English"): { refs: V5Reference[]; numOf: Map<string, number> } {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const ids = order.filter((id) => byId.has(id));
  const wiki = ids.filter((id) => byId.get(id)!.kind === "wikipedia");
  const group = wiki.length >= 3;
  const refs: V5Reference[] = [];
  const numOf = new Map<string, number>();
  const hi = /hindi/i.test(lang);
  for (const id of ids) {
    if (numOf.has(id)) continue;
    const s = byId.get(id)!;
    const n = refs.length + 1;
    if (group && s.kind === "wikipedia") {
      const arts = wiki.map((w) => byId.get(w)!);
      const d = new Date(s.accessed || Date.now());
      const acc = `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      const names = arts.map((a) => `“${String(a.title).trim()}”`).join(", ");
      refs.push({ n, sourceId: id, sourceIds: [...wiki], kind: "wikipedia", url: sourceLink(s), urls: arts.map(sourceLink), text: hi ? `विकिपीडिया, मुक्त विश्वकोश — लेख ${names} (देखे गए ${acc}).` : `Wikipedia, The Free Encyclopedia — articles ${names} (accessed ${acc}).` });
      for (const w of wiki) numOf.set(w, n);
      continue;
    }
    refs.push({ n, sourceId: id, sourceIds: [id], kind: s.kind, url: sourceLink(s), urls: [sourceLink(s)], text: citeSource(s, lang) });
    numOf.set(id, n);
  }
  return { refs, numOf };
}
