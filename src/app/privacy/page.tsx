import { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — DreamSun AI",
  description: "DreamSun AI privacy policy. How we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNavbar />

      <article className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-muted text-sm mb-12">Last updated: March 10, 2026</p>

        <div className="prose-sm space-y-8 text-muted [&_h2]:text-foreground [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-foreground [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:leading-relaxed">
          <section>
            <h2>1. Information We Collect</h2>
            <h3>Account Information</h3>
            <p>
              When you create an account, we collect your email address and authentication details
              through our authentication provider (Supabase Auth). We do not store passwords directly.
            </p>
            <h3>Usage Data</h3>
            <p>
              We collect information about how you use our service, including the models you select,
              generation parameters (prompts, aspect ratios, durations), and credit usage. This data
              helps us improve our service and provide accurate billing.
            </p>
            <h3>Payment Information</h3>
            <p>
              Payment processing is handled entirely by Stripe. We do not store your credit card
              numbers, bank account details, or other financial information on our servers. We retain
              your Stripe customer ID to manage subscriptions and purchases.
            </p>
            <h3>Generated Content</h3>
            <p>
              Images and videos you generate are stored temporarily in our cloud storage for delivery.
              We do not use your generated content for training AI models or share it with third parties.
            </p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To provide and maintain our AI generation services</li>
              <li>To process payments and manage your credit balance</li>
              <li>To send service-related communications (billing receipts, account updates)</li>
              <li>To improve our platform based on aggregate usage patterns</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2>3. Third-Party Services</h2>
            <p>We use the following third-party services to operate our platform:</p>
            <ul>
              <li><strong>Supabase</strong> — Authentication and database</li>
              <li><strong>Stripe</strong> — Payment processing</li>
              <li><strong>fal.ai</strong> — AI model inference (image and video generation)</li>
              <li><strong>Vercel</strong> — Application hosting</li>
            </ul>
            <p>
              Each of these providers has their own privacy policies. We encourage you to review them.
              Your prompts and generated content are sent to AI model providers for processing but are
              not retained by them for training purposes beyond the scope of their own privacy policies.
            </p>
          </section>

          <section>
            <h2>4. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Generated images and
              videos are stored for a reasonable period to allow you to access them. You may request
              deletion of your account and associated data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2>5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including
              encryption in transit (HTTPS/TLS), secure authentication, and access controls.
              However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          </section>

          <section>
            <h2>7. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We use a
              privacy-friendly analytics service that does not use cookies for tracking.
            </p>
          </section>

          <section>
            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any
              material changes by posting the new policy on this page and updating the &ldquo;Last
              updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>
              If you have questions about this privacy policy or your data, please contact us at{" "}
              <a href="mailto:privacy@dreamsunai.com" className="text-accent hover:underline">
                privacy@dreamsunai.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>

      <Footer />
    </main>
  );
}
