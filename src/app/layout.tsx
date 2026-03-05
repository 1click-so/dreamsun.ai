import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DreamSun.ai — AI Image & Video Generator",
  description:
    "AI platform aggregator for creating images and videos using state-of-the-art models.",
};

function Nav() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-6 px-6 py-2">
        <a href="/" className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
          Generator
        </a>
        <a href="/shots" className="text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]">
          Shot List
        </a>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Nav />
        {children}
      </body>
    </html>
  );
}
