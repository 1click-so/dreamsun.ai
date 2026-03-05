import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";
import { BentoGrid } from "@/components/landing/BentoGrid";
import { Gallery } from "@/components/landing/Gallery";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNavbar />
      <Hero />
      <BentoGrid />
      <Gallery />
      <Footer />
    </main>
  );
}
