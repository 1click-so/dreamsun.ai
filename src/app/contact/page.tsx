import { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Footer } from "@/components/landing/Footer";
import { Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact — DreamSun AI",
  description: "Get in touch with the DreamSun AI team.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNavbar />

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center text-accent mx-auto mb-6">
          <Mail size={24} />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Get in Touch
        </h1>

        <p className="text-muted text-base leading-relaxed mb-10 max-w-md mx-auto">
          Have a question, feedback, or need help with your account? We&apos;d love to hear from you.
        </p>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface/30 p-6">
            <h3 className="font-display font-semibold text-base mb-2">General Inquiries</h3>
            <a
              href="mailto:hello@dreamsunai.com"
              className="text-accent hover:underline text-sm"
            >
              hello@dreamsunai.com
            </a>
          </div>

          <div className="rounded-xl border border-border bg-surface/30 p-6">
            <h3 className="font-display font-semibold text-base mb-2">Support</h3>
            <a
              href="mailto:support@dreamsunai.com"
              className="text-accent hover:underline text-sm"
            >
              support@dreamsunai.com
            </a>
          </div>

          <div className="rounded-xl border border-border bg-surface/30 p-6">
            <h3 className="font-display font-semibold text-base mb-2">Legal &amp; Privacy</h3>
            <a
              href="mailto:legal@dreamsunai.com"
              className="text-accent hover:underline text-sm"
            >
              legal@dreamsunai.com
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
