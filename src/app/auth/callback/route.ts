import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/explore";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  // PKCE flow — exchange code for session (Google OAuth, email confirm)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectUrl = new URL(next, origin);

      // Detect new vs returning user for analytics
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const createdAt = new Date(user.created_at).getTime();
        const now = Date.now();
        const provider = user.app_metadata?.provider ?? "unknown";

        if (now - createdAt < 60_000) {
          // Brand new account — created in the last 60 seconds
          redirectUrl.searchParams.set("auth_event", `signup:${provider}`);
        } else {
          // Returning user
          redirectUrl.searchParams.set("auth_event", `login:${provider}`);
        }
      }

      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  // Token hash flow (email confirmations, password recovery)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery" | "signup" | "email",
    });
    if (!error) {
      const redirectUrl = new URL(next, origin);

      if (type === "signup") {
        redirectUrl.searchParams.set("auth_event", "signup:email");
      }

      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
