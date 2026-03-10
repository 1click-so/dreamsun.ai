import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

/** @deprecated Use getStripe() for lazy initialization */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export interface PlanConfig {
  name: string;
  priceInCents: number;      // monthly price in cents
  credits: number;           // monthly credit allocation
  bonusPct: number;          // bonus % over base rate
  stripePriceId?: string;    // set after creating products in Stripe
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    name: "Starter",
    priceInCents: 1000,
    credits: 1000,
    bonusPct: 0,
    stripePriceId: "price_1T9SMx4YHq2MwaOICHBdLhhA",
  },
  creator: {
    name: "Creator",
    priceInCents: 4000,
    credits: 4400,
    bonusPct: 10,
    stripePriceId: "price_1T9SMy4YHq2MwaOI8vHrIE93",
  },
  pro: {
    name: "Pro",
    priceInCents: 8000,
    credits: 9200,
    bonusPct: 15,
    stripePriceId: "price_1T9SMy4YHq2MwaOIAPliAvvi",
  },
};

/** Credits per $1 for top-up purchases (base rate, no discount) */
export const TOPUP_RATE = 100;

/** Minimum top-up in dollars */
export const TOPUP_MIN_DOLLARS = 5;

/** Maximum top-up in dollars (slider caps at 500, input allows up to this) */
export const TOPUP_MAX_DOLLARS = 2500;

// ── Discount Curve ──────────────────────────────────────────
// One formula for everything: slider and packages use the same math.
// Piecewise linear interpolation between breakpoints.

const DISCOUNT_CURVE = [
  { dollars: 5,   pct: 0 },
  { dollars: 10,  pct: 3 },
  { dollars: 25,  pct: 6 },
  { dollars: 50,  pct: 10 },
  { dollars: 75,  pct: 13 },
  { dollars: 100, pct: 16 },
  { dollars: 200, pct: 18 },
  { dollars: 500, pct: 20 },
];

/** Discount % for any dollar amount. Interpolates between breakpoints. */
export function getTopupDiscount(dollars: number): number {
  if (dollars <= DISCOUNT_CURVE[0].dollars) return 0;
  for (let i = 1; i < DISCOUNT_CURVE.length; i++) {
    if (dollars <= DISCOUNT_CURVE[i].dollars) {
      const prev = DISCOUNT_CURVE[i - 1];
      const curr = DISCOUNT_CURVE[i];
      const t = (dollars - prev.dollars) / (curr.dollars - prev.dollars);
      return Math.round(prev.pct + t * (curr.pct - prev.pct));
    }
  }
  return 20; // cap
}

/** Credits you get for a given dollar amount (base rate + discount). */
export function getCreditsForDollars(dollars: number): number {
  const discount = getTopupDiscount(dollars);
  return Math.round(dollars * TOPUP_RATE * (1 + discount / 100));
}

// ── Credit Packages (Top-up) ─────────────────────────────────

export interface CreditPackage {
  id: string;
  dollars: number;
  credits: number;
  discountPct: number;
  badge?: "most_popular" | "best_value";
}

/** 5 preset packages — credits computed from the same discount curve. */
export const CREDIT_PACKAGES: CreditPackage[] = [10, 25, 50, 75, 100].map((d, i) => ({
  id: `pack-${d}`,
  dollars: d,
  credits: getCreditsForDollars(d),
  discountPct: getTopupDiscount(d),
  badge: i === 2 ? "most_popular" as const : i === 4 ? "best_value" as const : undefined,
}));
