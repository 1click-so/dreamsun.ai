import { Navbar } from "@/components/Navbar";

export default function VideoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex items-center justify-center px-6 py-24">
        <p className="text-sm text-muted">Coming soon</p>
      </main>
    </div>
  );
}
