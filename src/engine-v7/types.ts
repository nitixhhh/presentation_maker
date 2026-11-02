/** Engine v7 — free-form design engine: shared types. No layout list, no slide "types": every slide is designed from scratch. */
import type { Brief, ResearchPack } from "../engine-v3/types";

export interface V7Request {
  topic: string;
  slideCount?: number;
  audience?: string;
  language?: "English" | "Hindi" | "Hinglish";
  styleHint?: string;
  /** max AI images for the whole deck (default 5) */
  aiImages?: number;
}

/** One slide's content, written before anything is designed. */
export interface V7Slide {
  n: number;
  title: string;
  /** what the audience should understand from this slide, in one sentence */
  idea: string;
  /** the actual words, numbers and data the slide carries (plain text, short) */
  body: string;
  /** fact ids (F1…) this slide relies on */
  facts: string[];
  notes: string;
}

/** The deck's own art direction, decided by the AI for this topic (free text — there is no preset list). */
export interface V7Concept {
  conceptName: string;
  artDirection: string;
  palette: { hex: string; use: string }[];
  fonts: { display: string; body: string; accent?: string };
  motif: string;
  imageStyle: string;
  storyboard: V7Board[];
}

export interface V7Board {
  n: number;
  /** how the idea is explained visually (the designer's sketch note) */
  visual: string;
  /** where things sit on the canvas */
  composition: string;
  /** an AI image for this slide, if the art director wants one */
  image?: { subject: string; aspect: string } | null;
}

export interface V7Image {
  n: number;
  file: string; // relative to the deck dir, e.g. img/s3.jpg
  width: number;
  height: number;
  kind: "ai" | "photo";
  subject: string;
  credit?: string;
}

export interface V7SlideResult {
  n: number;
  html: string;
  png: string; // absolute path
  rounds: number;
  score: number | null;
  issues: string[];
  model: string;
}

export interface V7Stats {
  calls: { role: string; route: string; ms: number; ok: boolean; label?: string }[];
  steps: { name: string; ms: number }[];
}

export interface V7Deck {
  id: string;
  dir: string;
  request: V7Request;
  brief: Brief;
  pack: ResearchPack;
  slides: V7Slide[];
  concept: V7Concept;
  images: V7Image[];
  results: V7SlideResult[];
  references: { n: number; text: string; url: string }[];
}
