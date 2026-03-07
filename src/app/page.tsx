import dynamic from "next/dynamic";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { Hero } from "@/components/landing/Hero";

const BentoGrid = dynamic(() => import("@/components/landing/BentoGrid").then((m) => m.BentoGrid));
const Gallery = dynamic(() => import("@/components/landing/Gallery").then((m) => m.Gallery));
const Footer = dynamic(() => import("@/components/landing/Footer").then((m) => m.Footer));

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
