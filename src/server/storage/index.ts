import type { StorageAdapter } from "./types";
import { LocalStorage } from "./local";
import { SupabaseStorage } from "./supabase";

declare global {
  var __deckcraftStorage: StorageAdapter | undefined;
}

/** Supabase when its server env is present, otherwise the local filesystem. */
export function storage(): StorageAdapter {
  if (globalThis.__deckcraftStorage) return globalThis.__deckcraftStorage;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const s: StorageAdapter = url && key && process.env.DECKCRAFT_STORAGE !== "local" ? new SupabaseStorage(url, key) : new LocalStorage();
  console.log(`[storage] using ${s.kind} storage`);
  globalThis.__deckcraftStorage = s;
  return s;
}

export type { StorageAdapter };
