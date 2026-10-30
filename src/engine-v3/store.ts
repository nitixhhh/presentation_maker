/** Engine v3 — deck storage on local disk (deck.json + assets + exports). */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Deck } from "./types";

import { DATA_ROOT } from "@/server/paths";

export const DECKS_ROOT = process.env.DECKCRAFT_V3_DIR || path.join(DATA_ROOT, "decks");

export function newDeckId(): string {
  return `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(5).toString("hex")}`;
}

export function deckDir(id: string): string {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("bad deck id");
  return path.join(DECKS_ROOT, id);
}

export function assetDir(id: string): string {
  const d = path.join(deckDir(id), "assets");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function saveDeck(deck: Deck) {
  fs.mkdirSync(deckDir(deck.id), { recursive: true });
  fs.writeFileSync(path.join(deckDir(deck.id), "deck.json"), JSON.stringify(deck, null, 2));
}

export function loadDeck(id: string): Deck | null {
  const p = path.join(deckDir(id), "deck.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
