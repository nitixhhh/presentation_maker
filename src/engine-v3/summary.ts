/** Engine v3 — the compact deck shape the website UI consumes. */
import type { Deck } from "./types";

export function deckSummary(deck: Deck) {
  const titleOf = (n: number) => deck.outline.slides.find((s) => s.n === n)?.title || `Slide ${n}`;
  return {
    engine: "v3",
    deckId: deck.id,
    topic: deck.request.topic,
    title: deck.brief.title,
    language: deck.brief.language,
    design: { name: deck.design.name, palette: deck.design.palette, fonts: [deck.design.font.heading, deck.design.font.body], motif: deck.design.motif },
    references: deck.references,
    slides: deck.slides.map((s) => ({
      n: s.n,
      title: titleOf(s.n),
      role: deck.outline.slides.find((o) => o.n === s.n)?.role,
      url: `/api/v3/deck/${deck.id}/slide/${s.n}`,
      image: `/api/v3/deck/${deck.id}/preview/${s.n}`,
      notes: s.notes,
      qaScore: s.qa?.visionScore ?? null,
      revisions: s.revisions,
    })),
  };
}
