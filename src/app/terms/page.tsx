import { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Terms of Service — DreamSun AI",
  description: "DreamSun AI terms of service. Rules and guidelines for using our platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={14} />
          <span className="font-display font-bold text-lg tracking-tight">DreamSun</span>
        </Link>
        <Link href="/" className="text-sm text-muted hover:text-accent transition-colors">
          Back to Home
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Terms of Service
        </h1>
        <p className="text-muted text-sm mb-12">Last updated: March 10, 2026</p>

        <div className="prose-sm space-y-8 text-muted [&_h2]:text-foreground [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:leading-relaxed">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using DreamSun AI (&ldquo;the Service&rdquo;), you agree to be bound
              by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              DreamSun AI is a platform that provides access to AI-powered image and video generation
              models from various providers. The Service allows you to generate visual content using
              text prompts and reference images through a credit-based system.
            </p>
          </section>

          <section>
            <h2>3. Accounts</h2>
            <p>
              You must create an account to use the Service. You are responsible for maintaining the
              security of your account credentials. You must be at least 18 years old to use the
              Service. You may not create accounts for bots or automated systems without prior
              written permission.
            </p>
          </section>

          <section>
            <h2>4. Credits and Payments</h2>
            <ul>
              <li>New accounts receive 100 free credits.</li>
              <li>Credits are consumed when generating images or videos. Different models and settings have different credit costs.</li>
              <li>Subscription plans provide monthly credit allocations. Unused credits do not roll over.</li>
              <li>Top-up credits do not expire and are available until used.</li>
              <li>Credits are non-refundable and non-transferable.</li>
              <li>If a generation fails due to a system error, credits are automatically refunded.</li>
              <li>All prices are in USD. Payments are processed by Stripe.</li>
            </ul>
          </section>

          <section>
            <h2>5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Generate content that depicts minors in sexual or harmful situations</li>
              <li>Generate content that infringes on intellectual property rights of others</li>
              <li>Create deepfakes or misleading content intended to deceive or harm real people</li>
              <li>Generate content that promotes violence, terrorism, or illegal activities</li>
              <li>Circumvent safety filters or abuse the API in unauthorized ways</li>
              <li>Resell or redistribute generated content as an AI generation service</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms without
              notice or refund.
            </p>
          </section>

          <section>
            <h2>6. Content Ownership</h2>
            <p>
              You retain ownership of content you generate using the Service, subject to the
              underlying AI model provider&apos;s terms. You may use generated content for personal
              and commercial purposes. We do not claim ownership over your generated content.
            </p>
          </section>

          <section>
            <h2>7. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted service. AI
              model providers may experience outages, rate limits, or changes that affect
              availability. We are not liable for service interruptions caused by third-party
              providers.
            </p>
          </section>

          <section>
            <h2>8. Limitation of Liability</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We are not
              liable for any indirect, incidental, or consequential damages arising from your use of
              the Service. Our total liability is limited to the amount you have paid us in the 12
              months preceding the claim.
            </p>
          </section>

          <section>
            <h2>9. Changes to Terms</h2>
            <p>
              We may update these terms at any time. Continued use of the Service after changes
              constitutes acceptance of the new terms. Material changes will be communicated via
              email or notice on the platform.
            </p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>
              You may delete your account at any time. We may suspend or terminate your account for
              violations of these terms. Upon termination, your access to the Service and any
              remaining credits will be forfeited.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a href="mailto:legal@dreamsunai.com" className="text-accent hover:underline">
                legal@dreamsunai.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
