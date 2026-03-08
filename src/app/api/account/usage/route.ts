import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  // Fetch limit+1 to detect if there are more rows
  const { data: transactions, error } = await supabase
    .from("credit_transactions")
    .select("id, created_at, type, amount, pool, balance_after, description")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const has_more = (transactions?.length || 0) > limit;
  const items = has_more ? transactions!.slice(0, limit) : (transactions || []);

  return NextResponse.json({
    transactions: items,
    page,
    limit,
    has_more,
  });
}
