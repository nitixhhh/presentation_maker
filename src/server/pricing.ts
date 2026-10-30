/** Prices in INR (paise internally). Change with env vars; no code change needed. */
export interface Pricing {
  currency: "INR";
  deck: number; // ₹ per deck
  firstDeck: number; // ₹ for a user's first deck (0 = free)
  pack5: number; // ₹ for 5 deck credits
  referralCredits: number; // credits the referrer gets when a friend signs up
  freeEdits: number; // edits included after unlocking a deck
}

export function pricing(): Pricing {
  const n = (v: string | undefined, d: number) => (v !== undefined && v !== "" && !isNaN(Number(v)) ? Number(v) : d);
  return {
    currency: "INR",
    deck: n(process.env.PRICE_DECK_INR, 39),
    firstDeck: n(process.env.PRICE_FIRST_DECK_INR, 9),
    pack5: n(process.env.PRICE_PACK5_INR, 149),
    referralCredits: n(process.env.REFERRAL_CREDITS, 1),
    freeEdits: n(process.env.FREE_EDITS_PER_DECK, 2),
  };
}

export type Product = "deck" | "pack5";
