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
  },
  creator: {
    name: "Creator",
    priceInCents: 4000,
    credits: 4400,
    bonusPct: 10,
  },
  pro: {
    name: "Pro",
    priceInCents: 8000,
    credits: 9200,
    bonusPct: 15,
  },
};

/** Credits per $1 for top-up purchases */
export const TOPUP_RATE = 100;

/** Minimum top-up in dollars */
export const TOPUP_MIN_DOLLARS = 5;

/** Maximum top-up in dollars */
export const TOPUP_MAX_DOLLARS = 500;
