/**
 * Live slide-by-slide generation (Standard and Advanced tiers): the options a template engine takes from the
 * job manager, the events it sends while slides are made, and where each slide's preview JPEG lives.
 */
import path from "path";
import { deckDir } from "../engine-v3/store";
import type { ProgressFn } from "../engine-v3/types";

export type LiveState = "waiting" | "building" | "ready" | "polishing" | "done";
export interface LiveSlideEvent {
  n: number;
  state: LiveState;
  title?: string;
  status?: string;
  /** a new preview JPEG was written for this slide */
  preview?: boolean;
}

export interface LiveOptions {
  onProgress?: ProgressFn;
  onDeckId?: (id: string) => void;
  /** live slide-by-slide UI: plan known, slide status text, slide ready (preview written) */
  onPlan?: (slides: { n: number; title: string; role: string; layout: string }[]) => void;
  onSlide?: (e: LiveSlideEvent) => void;
  maxRevisions?: number;
  visionMode?: "smart" | "always" | "off";
}

export function previewFile(deckId: string, n: number) {
  return path.join(deckDir(deckId), "previews", `slide-${String(n).padStart(2, "0")}.jpg`);
}
