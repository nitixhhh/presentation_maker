/**
 * Accounts data: profiles (referral codes), credits, orders, unlocked decks, edit counts.
 * Supabase tables (supabase/schema.sql) when SUPABASE_SERVICE_ROLE_KEY is set, else one JSON file on disk.
 * Every write that comes from a payment is idempotent (same payment twice = one unlock).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DATA_ROOT } from "../paths";
import type { Product } from "../pricing";

export interface Profile {
  id: string; // auth user id
  email?: string;
  name?: string;
  referralCode: string;
  referredBy?: string; // referrer user id
  createdAt: string;
}

export interface Order {
  id: string;
  ownerKey: string;
  userId?: string;
  product: Product;
  deckId?: string;
  amount: number; // paise
  currency: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId?: string;
  status: "created" | "paid" | "failed";
  createdAt: string;
  paidAt?: string;
}

export interface AccountsStore {
  getProfile(id: string): Promise<Profile | null>;
  upsertProfile(p: Profile): Promise<void>;
  profileByReferralCode(code: string): Promise<Profile | null>;
  credits(ownerKey: string): Promise<number>;
  /** idempotent per ref */
  addCredits(ownerKey: string, delta: number, reason: string, ref: string): Promise<boolean>;
  createOrder(o: Order): Promise<void>;
  orderByProviderId(providerOrderId: string): Promise<Order | null>;
  /** returns true only for the call that flipped it to paid */
  markOrderPaid(providerOrderId: string, paymentId: string): Promise<boolean>;
  isUnlocked(ownerKey: string, deckId: string): Promise<boolean>;
  unlock(ownerKey: string, deckId: string, via: string, ref: string): Promise<void>;
  unlockCount(ownerKey: string): Promise<number>;
  editsUsed(deckId: string): Promise<number>;
  addEdit(deckId: string): Promise<number>;
}

// ── local JSON ─────────────────────────────────────────────────────────────────
interface LocalDb {
  profiles: Record<string, Profile>;
  creditEvents: { ownerKey: string; delta: number; reason: string; ref: string; at: string }[];
  orders: Record<string, Order>;
  unlocks: { ownerKey: string; deckId: string; via: string; ref: string; at: string }[];
  edits: Record<string, number>;
}

class LocalAccounts implements AccountsStore {
  private file = path.join(DATA_ROOT, "accounts.json");
  private db: LocalDb;
  constructor() {
    try {
      this.db = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      this.db = { profiles: {}, creditEvents: [], orders: {}, unlocks: [], edits: {} };
    }
  }
  private save() {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
  }
  async getProfile(id: string) {
    return this.db.profiles[id] || null;
  }
  async upsertProfile(p: Profile) {
    this.db.profiles[p.id] = { ...this.db.profiles[p.id], ...p };
    this.save();
  }
  async profileByReferralCode(code: string) {
    return Object.values(this.db.profiles).find((p) => p.referralCode === code) || null;
  }
  async credits(ownerKey: string) {
    return this.db.creditEvents.filter((e) => e.ownerKey === ownerKey).reduce((s, e) => s + e.delta, 0);
  }
  async addCredits(ownerKey: string, delta: number, reason: string, ref: string) {
    if (this.db.creditEvents.some((e) => e.ref === ref)) return false;
    this.db.creditEvents.push({ ownerKey, delta, reason, ref, at: new Date().toISOString() });
    this.save();
    return true;
  }
  async createOrder(o: Order) {
    this.db.orders[o.providerOrderId] = o;
    this.save();
  }
  async orderByProviderId(id: string) {
    return this.db.orders[id] || null;
  }
  async markOrderPaid(id: string, paymentId: string) {
    const o = this.db.orders[id];
    if (!o || o.status === "paid") return false;
    o.status = "paid";
    o.providerPaymentId = paymentId;
    o.paidAt = new Date().toISOString();
    this.save();
    return true;
  }
  async isUnlocked(ownerKey: string, deckId: string) {
    return this.db.unlocks.some((u) => u.ownerKey === ownerKey && u.deckId === deckId);
  }
  async unlock(ownerKey: string, deckId: string, via: string, ref: string) {
    if (await this.isUnlocked(ownerKey, deckId)) return;
    this.db.unlocks.push({ ownerKey, deckId, via, ref, at: new Date().toISOString() });
    this.save();
  }
  async unlockCount(ownerKey: string) {
    return this.db.unlocks.filter((u) => u.ownerKey === ownerKey).length;
  }
  async editsUsed(deckId: string) {
    return this.db.edits[deckId] || 0;
  }
  async addEdit(deckId: string) {
    this.db.edits[deckId] = (this.db.edits[deckId] || 0) + 1;
    this.save();
    return this.db.edits[deckId];
  }
}

// ── Supabase ───────────────────────────────────────────────────────────────────
class SupabaseAccounts implements AccountsStore {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  private must<T>(r: { data: T; error: any }, what: string): T {
    if (r.error) throw new Error(`supabase ${what}: ${r.error.message}`);
    return r.data;
  }
  async getProfile(id: string) {
    const d: any = this.must(await this.db.from("profiles").select("*").eq("id", id).maybeSingle(), "getProfile");
    return d ? { id: d.id, email: d.email, name: d.name, referralCode: d.referral_code, referredBy: d.referred_by || undefined, createdAt: d.created_at } : null;
  }
  async upsertProfile(p: Profile) {
    this.must(await this.db.from("profiles").upsert({ id: p.id, email: p.email, name: p.name, referral_code: p.referralCode, referred_by: p.referredBy || null }), "upsertProfile");
  }
  async profileByReferralCode(code: string) {
    const d: any = this.must(await this.db.from("profiles").select("id").eq("referral_code", code).maybeSingle(), "profileByReferralCode");
    return d ? this.getProfile(d.id) : null;
  }
  async credits(ownerKey: string) {
    const d: any = this.must(await this.db.from("credit_events").select("delta").eq("owner_key", ownerKey), "credits");
    return ((d || []) as any[]).reduce((s: number, e: any) => s + e.delta, 0);
  }
  async addCredits(ownerKey: string, delta: number, reason: string, ref: string) {
    const r = await this.db.from("credit_events").insert({ owner_key: ownerKey, delta, reason, ref });
    if (r.error) {
      if (/duplicate|unique/i.test(r.error.message)) return false;
      throw new Error(`supabase addCredits: ${r.error.message}`);
    }
    return true;
  }
  async createOrder(o: Order) {
    this.must(
      await this.db.from("orders").insert({ id: o.id, owner_key: o.ownerKey, user_id: o.userId || null, product: o.product, deck_id: o.deckId || null, amount: o.amount, currency: o.currency, provider: o.provider, provider_order_id: o.providerOrderId, status: o.status }),
      "createOrder"
    );
  }
  async orderByProviderId(id: string) {
    const d: any = this.must(await this.db.from("orders").select("*").eq("provider_order_id", id).maybeSingle(), "orderByProviderId");
    return d
      ? { id: d.id, ownerKey: d.owner_key, userId: d.user_id || undefined, product: d.product, deckId: d.deck_id || undefined, amount: d.amount, currency: d.currency, provider: d.provider, providerOrderId: d.provider_order_id, providerPaymentId: d.provider_payment_id || undefined, status: d.status, createdAt: d.created_at, paidAt: d.paid_at || undefined }
      : null;
  }
  async markOrderPaid(id: string, paymentId: string) {
    // conditional update = idempotent: only the first caller sees a row come back
    const d: any = this.must(await this.db.from("orders").update({ status: "paid", provider_payment_id: paymentId, paid_at: new Date().toISOString() }).eq("provider_order_id", id).neq("status", "paid").select("id"), "markOrderPaid");
    return (d || []).length > 0;
  }
  async isUnlocked(ownerKey: string, deckId: string) {
    const d: any = this.must(await this.db.from("unlocks").select("deck_id").eq("owner_key", ownerKey).eq("deck_id", deckId).limit(1), "isUnlocked");
    return (d || []).length > 0;
  }
  async unlock(ownerKey: string, deckId: string, via: string, ref: string) {
    const r = await this.db.from("unlocks").upsert({ owner_key: ownerKey, deck_id: deckId, via, ref }, { onConflict: "owner_key,deck_id", ignoreDuplicates: true });
    if (r.error) throw new Error(`supabase unlock: ${r.error.message}`);
  }
  async unlockCount(ownerKey: string) {
    const r = await this.db.from("unlocks").select("deck_id", { count: "exact", head: true }).eq("owner_key", ownerKey);
    return r.count || 0;
  }
  async editsUsed(deckId: string) {
    const d: any = this.must(await this.db.from("deck_edits").select("count").eq("deck_id", deckId).maybeSingle(), "editsUsed");
    return d?.count || 0;
  }
  async addEdit(deckId: string) {
    const n = (await this.editsUsed(deckId)) + 1;
    this.must(await this.db.from("deck_edits").upsert({ deck_id: deckId, count: n }), "addEdit");
    return n;
  }
}

declare global {
  var __deckcraftAccounts: AccountsStore | undefined;
}

export function accounts(): AccountsStore {
  if (globalThis.__deckcraftAccounts) return globalThis.__deckcraftAccounts;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.__deckcraftAccounts = url && key && process.env.DECKCRAFT_STORAGE !== "local" ? new SupabaseAccounts(url, key) : new LocalAccounts();
  return globalThis.__deckcraftAccounts;
}

export function newReferralCode() {
  return crypto.randomBytes(5).toString("base64url").replace(/[-_]/g, "x").slice(0, 7).toUpperCase();
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(6).toString("hex")}`;
}
