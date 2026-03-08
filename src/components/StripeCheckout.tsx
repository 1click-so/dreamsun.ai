"use client";

import { useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface StripeCheckoutProps {
  fetchClientSecret: () => Promise<string>;
}

export function StripeCheckoutForm({ fetchClientSecret }: StripeCheckoutProps) {
  const fetchSecret = useCallback(fetchClientSecret, [fetchClientSecret]);

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret: fetchSecret }}>
      <EmbeddedCheckout className="stripe-checkout" />
    </EmbeddedCheckoutProvider>
  );
}
