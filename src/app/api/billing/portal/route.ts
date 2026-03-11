import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    const origin = req.headers.get("origin") || "https://dreamsunai.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/account?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing-portal] Error:", error);
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
  }
}
