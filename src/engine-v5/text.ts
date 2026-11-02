/**
 * Engine v5 — slide copy is natural language. Research facts carry source ids and URLs; those belong on the
 * references slide (as proper citations), never inside a title, bullet, card or note. naturalText() removes what a
 * model sometimes pastes into slot text: URLs and bare domains, wiki paths, citation markers ([12], [citation
 * needed]), fact / source ids (F3, S2), "Source: …" tails and "according to Wikipedia" phrasing.
 */

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
// bare domains with a path or a well-known TLD ("en.wikipedia.org/wiki/Gini", "doi.org/10.1086/654291", "nasa.gov")
const DOMAIN_RE = /\b(?:(?:[a-z0-9-]+\.)+(?:org|com|net|edu|gov|int|io|in|uk)\/[^\s<>"')\]]*|(?:[a-z0-9-]+\.)*(?:wikipedia|wikimedia|britannica|doi|openalex|arxiv|crossref)\.(?:org|com)\b)/gi;
const DOI_RE = /\b(?:doi:\s*)?10\.\d{4,9}\/[^\s<>"')\]]+/gi;
const CITE_MARK_RE = /\[(?:\d{1,3}(?:\s*[,–-]\s*\d{1,3})*|citation needed|note \d+|[a-z])\]/gi;
const IDS_BRACKET_RE = /\s*[\[(]\s*(?:(?:[FS]\d{1,3}|ref\.?\s*\d{1,3}|source\s*\d{1,3})\s*[,;/]?\s*(?:and\s*)?)+[\])]/gi;
const IDS_BARE_RE = /(^|\s)\b[FS]\d{1,3}(?:\s*,\s*[FS]\d{1,3})*\b(?=[\s.,;:]|$)/g;
const SOURCE_TAIL_RE = /\s*[(\[]?\s*(?:source|sources|via|ref|retrieved from|see)\s*[:：]\s*[^.;)\]]*[)\]]?\s*$/i;
const PAREN_SITE_RE = /\s*\((?:wikipedia|wikimedia(?: commons)?|britannica|openalex|arxiv|crossref|europe ?pmc|semantic scholar)\)/gi;
const ACCORDING_RE = /\b(?:according to|as per|per|from|says|on)\s+(?:the\s+)?(?:english\s+)?(?:wikipedia|wikimedia|openalex|arxiv|crossref)(?:\s+(?:article|page|entry))?\s*(?:on\s+[^,.;]+)?,?\s*/gi;

/** natural-language slot text: no URLs, wiki paths, citation markers, fact ids or source tails */
export function naturalText(t: string): string {
  let s = String(t ?? "");
  if (!s) return s;
  s = s.replace(/\[([^\]]{1,80})\]\((?:https?:\/\/|www\.)[^)]+\)/g, "$1"); // markdown links keep their words
  s = s.replace(URL_RE, " ").replace(DOI_RE, " ").replace(DOMAIN_RE, " ");
  s = s.replace(CITE_MARK_RE, "").replace(IDS_BRACKET_RE, "").replace(IDS_BARE_RE, "$1");
  s = s.replace(PAREN_SITE_RE, "").replace(ACCORDING_RE, "");
  s = s.replace(SOURCE_TAIL_RE, "");
  s = s.replace(/\b(?:see|visit|read more(?: at)?|more at)\s*(?:for (?:more )?(?:details|info(?:rmation)?))?\s*(?=[.,;]|$)/gi, "");
  // tidy what the removals left behind
  s = s.replace(/\(\s*[,;:]*\s*\)|\[\s*\]/g, "").replace(/\s+([.,;:!?।])/g, "$1").replace(/([,;:])\1+/g, "$1").replace(/[,;:]\s*([.!?।])/g, "$1");
  s = s.replace(/\s{2,}/g, " ").replace(/^[\s,;:–—-]+/, "").replace(/[\s,;:–—-]+$/, "").trim();
  // a sentence that started lower-case after "According to Wikipedia, …" was removed
  if (/^[a-z]/.test(s) && /^[A-Z]/.test(String(t).trim())) s = s[0].toUpperCase() + s.slice(1);
  return s;
}

/** true when text still carries a link, a wiki path, a DOI or a citation marker (a QA check for slide copy) */
export function hasRawRef(t: string): boolean {
  const s = String(t ?? "");
  return new RegExp(URL_RE.source, "i").test(s) || new RegExp(DOMAIN_RE.source, "i").test(s) || new RegExp(DOI_RE.source, "i").test(s) || /\[\d{1,3}\]|\[citation needed\]/i.test(s) || /(^|\s)[FS]\d{1,3}(?=[\s.,;:]|$)/.test(s);
}
