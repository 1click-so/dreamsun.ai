"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Logo } from "@/components/Logo";
import Link from "next/link";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

/** Visual showcase left panel — image collage */
const SHOWCASE_IMAGES = [
  { src: "https://picsum.photos/seed/cyberpunk/400/500", alt: "Cyberpunk city" },
  { src: "https://picsum.photos/seed/portrait/400/300", alt: "AI portrait" },
  { src: "https://picsum.photos/seed/fantasy/400/500", alt: "Fantasy landscape" },
  { src: "https://picsum.photos/seed/neon/400/300", alt: "Neon abstract" },
  { src: "https://picsum.photos/seed/surreal/400/500", alt: "Surreal art" },
  { src: "https://picsum.photos/seed/space/400/300", alt: "Space scene" },
];

function DreamPanel() {
  return (
    <div className="relative hidden lg:flex overflow-hidden bg-background">
      {/* Image collage — 2 columns, offset masonry */}
      <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2">
        {/* Column 1 */}
        <div className="flex flex-col gap-2 -mt-8 login-col-1">
          {[...SHOWCASE_IMAGES.filter((_, i) => i % 2 === 0), ...SHOWCASE_IMAGES.filter((_, i) => i % 2 === 0)].map((img, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg" style={{ aspectRatio: "4/5" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
        {/* Column 2 — offset */}
        <div className="flex flex-col gap-2 mt-12 login-col-2">
          {[...SHOWCASE_IMAGES.filter((_, i) => i % 2 === 1), ...SHOWCASE_IMAGES.filter((_, i) => i % 2 === 1)].map((img, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg" style={{ aspectRatio: "4/3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/40 z-10" />

      {/* Floating orb glow on top */}
      <div className="login-orb-1 absolute top-[20%] left-[30%] h-48 w-48 rounded-full bg-accent/[0.15] blur-[80px] z-10" />
      <div className="login-orb-2 absolute bottom-[30%] right-[20%] h-36 w-36 rounded-full bg-accent/[0.10] blur-[60px] z-10" />

      {/* Bottom content — tagline over the collage */}
      <div className="relative z-20 flex flex-col justify-end p-10">
        <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground">
          Imagine it.
          <br />
          <span className="text-accent">Create it.</span>
        </h2>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
          AI-powered image, video, and audio generation for creators who think visually.
        </p>
      </div>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const next = searchParams.get("next") ?? "/images";

  function switchMode(to: Mode) {
    setMode(to);
    setError(null);
    setMessage(null);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for a confirmation link.");
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      }
    );

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for a password reset link.");
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
    if (authError) {
      setError(authError.message);
    }
  }

  const titles: Record<Mode, { heading: string; sub: string }> = {
    signin: { heading: "Welcome back", sub: "Sign in to your account" },
    signup: { heading: "Create account", sub: "Get started with DreamSun" },
    forgot: { heading: "Reset password", sub: "We'll send you a reset link" },
  };

  const inputClass =
    "w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:border-accent outline-none transition-colors";

  const submitClass =
    "w-full py-3 rounded-lg bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Left — visual panel (hidden on mobile) */}
      <DreamPanel />

      {/* Right — form */}
      <div className="relative flex flex-col">
        {/* Mobile logo + back link (visible on small screens only) */}
        <div className="flex items-center justify-between p-5 lg:p-8">
          <Link href="/" className="inline-flex items-center gap-2.5 transition hover:opacity-80">
            <Logo size={20} />
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              DreamSun
            </span>
          </Link>
        </div>

        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center px-5 pb-12 lg:px-12">
          <div className="login-fade-up w-full max-w-sm">
            {/* Title */}
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {titles[mode].heading}
              </h1>
              <p className="mt-1.5 text-sm text-muted">{titles[mode].sub}</p>
            </div>

            {/* Success message */}
            {message && (
              <div className="mb-4 rounded-lg border border-accent/20 bg-accent/10 p-3 text-center text-sm text-accent">
                {message}
              </div>
            )}

            {/* Google OAuth — shown on signin and signup */}
            {mode !== "forgot" && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted">or</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sign In Form */}
            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="text-sm text-center text-destructive">{error}</p>
                )}

                <button type="submit" disabled={loading} className={submitClass}>
                  {loading ? "Signing in..." : "Sign in"}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    Create account
                  </button>
                </div>
              </form>
            )}

            {/* Sign Up Form */}
            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Password</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="text-sm text-center text-destructive">{error}</p>
                )}

                <button type="submit" disabled={loading} className={submitClass}>
                  {loading ? "Creating account..." : "Create account"}
                </button>

                <p className="text-sm text-center text-muted">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* Forgot Password Form */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="text-sm text-center text-destructive">{error}</p>
                )}

                <button type="submit" disabled={loading} className={submitClass}>
                  {loading ? "Sending..." : "Send reset link"}
                </button>

                <p className="text-sm text-center text-muted">
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
