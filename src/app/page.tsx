import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ModelsSection } from "@/components/landing/ModelsSection";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNavbar />
      <Hero />
      <FeaturesSection />
      <ModelsSection />
      <LandingPricing />
      <Footer />
    </main>
  );
}
