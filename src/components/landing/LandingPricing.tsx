"use client";

import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonusPct: number;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 10,
    credits: 1000,
    bonusPct: 0,
    features: [
      "1,000 credits/month",
      "All image models",
      "All video models",
      "Shots & storyboarding",
      "Upscale & edit",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    price: 40,
    credits: 4400,
    bonusPct: 10,
    features: [
      "4,400 credits/month",
      "10% bonus credits",
      "All image models",
      "All video models",
      "Shots & storyboarding",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 80,
    credits: 9200,
    bonusPct: 15,
    features: [
      "9,200 credits/month",
      "15% bonus credits",
      "All image models",
      "All video models",
      "Shots & storyboarding",
      "Priority support",
    ],
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="py-28 px-6 md:px-12">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">
            Pricing
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted text-base max-w-lg mx-auto">
            Start free with 100 credits. Subscribe for monthly credits with bonus, or top up anytime with volume discounts.
          </p>
        </motion.div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative rounded-xl border p-7 flex flex-col ${
                plan.popular
                  ? "border-accent/40 bg-accent/[0.03]"
                  : "border-border bg-surface/30"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-bold bg-accent text-black px-4 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <h3 className="font-display text-lg font-semibold mb-1">{plan.name}</h3>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-display text-4xl font-bold tracking-tight">${plan.price}</span>
                <span className="text-muted text-sm">/mo</span>
              </div>

              {plan.bonusPct > 0 && (
                <p className="text-accent text-xs font-medium mb-5">
                  +{plan.bonusPct}% bonus credits
                </p>
              )}
              {plan.bonusPct === 0 && <div className="mb-5" />}

              <ul className="flex-1 space-y-3 mb-7">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-muted">
                    <Check size={14} className="text-accent mt-0.5 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href="/login?mode=signup"
                className={`w-full py-3 rounded-lg text-sm font-semibold text-center transition-all ${
                  plan.popular
                    ? "bg-accent text-black hover:shadow-[0_0_24px_rgba(161,252,223,0.2)] hover:scale-[1.02]"
                    : "border border-border text-foreground hover:bg-surface hover:border-accent/30"
                }`}
              >
                Get Started
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Top-up mention */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 text-center"
        >
          <p className="text-muted text-sm">
            Need more? <span className="text-foreground font-medium">Top up anytime</span> with
            volume discounts up to 20%.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-1.5 text-accent text-sm font-medium mt-2 hover:underline"
          >
            See top-up pricing <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
