import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

/** GET /api/checkout/session?id=cs_xxx — returns session metadata for analytics */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only return session data if it belongs to this user
    if (session.metadata?.supabase_user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      type: session.metadata?.type,
      plan: session.metadata?.plan_id,
      credits: session.metadata?.credits ? parseInt(session.metadata.credits, 10) : undefined,
      amount: session.amount_total ? session.amount_total / 100 : undefined,
      status: session.payment_status,
    });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
