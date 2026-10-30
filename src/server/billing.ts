/**
 * See first, pay later. A finished deck is visible as watermarked images only; the clean PDF, editable
 * PPTX, speaker notes and the HTML slides unlock after payment (or a credit). With payments off
 * (no provider configured) everything is unlocked — free testing mode.
 */
import { loadDeck } from "@/engine-v3/store";
import type { Deck } from "@/engine-v3/types";
import { accounts, newId, newReferralCode, type Order, type Profile } from "./accounts/store";
import { paymentProvider, paymentsEnabled } from "./payments";
import { pricing, type Product } from "./pricing";
import type { AuthUser } from "./auth";

export interface Access {
  deck: Deck;
  owner: boolean;
  unlocked: boolean;
}

/** Owner = the account/browser that made the deck. Decks made before ownership existed are open to anyone holding the id. */
export async function deckAccess(deckId: string, ownerKey: string): Promise<Access | null> {
  const deck = loadDeck(deckId);
  if (!deck) return null;
  const isPublic = !!(deck as any).public;
  const owner = isPublic || !deck.ownerKey || deck.ownerKey === ownerKey;
  if (!owner) return { deck, owner: false, unlocked: false };
  if (!paymentsEnabled()) return { deck, owner, unlocked: true };
  const unlocked = !isPublic && (await accounts().isUnlocked(deck.ownerKey || ownerKey, deckId));
  return { deck, owner, unlocked };
}

export async function priceFor(ownerKey: string, product: Product): Promise<number> {
  const p = pricing();
  if (product === "pack5") return p.pack5;
  const n = await accounts().unlockCount(ownerKey);
  return n === 0 ? p.firstDeck : p.deck;
}

export async function ensureProfile(user: AuthUser): Promise<Profile> {
  const a = accounts();
  const existing = await a.getProfile(user.id);
  if (existing) return existing;
  const profile = { id: user.id, email: user.email, name: user.name, referralCode: newReferralCode(), createdAt: new Date().toISOString() };
  await a.upsertProfile(profile);
  return profile;
}

/** A new user arriving through a friend's link: the friend (referrer) gets credit once. */
export async function claimReferral(user: AuthUser, code: string): Promise<{ ok: boolean; reason?: string }> {
  const a = accounts();
  const me = await ensureProfile(user);
  if (me.referredBy) return { ok: false, reason: "already referred" };
  // only brand-new accounts (first 24 h) can be referred
  if (Date.now() - Date.parse(me.createdAt) > 24 * 3600_000) return { ok: false, reason: "account too old" };
  const ref = await a.profileByReferralCode(String(code || "").toUpperCase().slice(0, 12));
  if (!ref || ref.id === user.id) return { ok: false, reason: "invalid code" };
  await a.upsertProfile({ ...me, referredBy: ref.id });
  const n = pricing().referralCredits;
  if (n > 0) await a.addCredits(`u:${ref.id}`, n, "referral", `referral:${user.id}`);
  return { ok: true };
}

export async function createPaymentOrder(ownerKey: string, user: AuthUser | null, product: Product, deckId?: string) {
  const provider = paymentProvider();
  if (!provider) throw new Error("Payments are not enabled.");
  const rupees = await priceFor(ownerKey, product);
  const id = newId("ord");
  if (rupees <= 0) {
    // free first deck
    if (product === "deck" && deckId) await accounts().unlock(ownerKey, deckId, "free-first", id);
    return { free: true as const };
  }
  const created = await provider.createOrder({ amount: Math.round(rupees * 100), currency: "INR", receipt: id, notes: { product, deckId: deckId || "", owner: ownerKey.slice(0, 60) } });
  const order: Order = { id, ownerKey, userId: user?.id, product, deckId, amount: created.amount, currency: created.currency, provider: provider.name, providerOrderId: created.providerOrderId, status: "created", createdAt: new Date().toISOString() };
  await accounts().createOrder(order);
  return { free: false as const, orderId: id, provider: provider.name, amount: created.amount, currency: created.currency, checkout: created.checkout, user: user ? { email: user.email, name: user.name } : null };
}

/** Called from the checkout callback AND the webhook; whichever comes first does the work, once. */
export async function fulfil(providerOrderId: string, paymentId: string) {
  const a = accounts();
  const order = await a.orderByProviderId(providerOrderId);
  if (!order) return { ok: false, reason: "unknown order" };
  const first = await a.markOrderPaid(providerOrderId, paymentId);
  if (order.product === "pack5") {
    await a.addCredits(order.ownerKey, 5, "pack5", `order:${order.id}`);
    // buying the pack from a deck page also unlocks that deck with one of the new credits
    if (order.deckId) await useCredit(order.ownerKey, order.deckId);
  } else if (order.deckId) {
    await a.unlock(order.ownerKey, order.deckId, "payment", order.id);
  }
  return { ok: true, first, order };
}

export async function useCredit(ownerKey: string, deckId: string): Promise<boolean> {
  const a = accounts();
  if (await a.isUnlocked(ownerKey, deckId)) return true;
  if ((await a.credits(ownerKey)) < 1) return false;
  const took = await a.addCredits(ownerKey, -1, "unlock", `use:${ownerKey}:${deckId}`);
  if (took) await a.unlock(ownerKey, deckId, "credit", `use:${deckId}`);
  return true;
}
