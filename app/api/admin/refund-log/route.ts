import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("refund_log")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Failed to load" }, { status: 500 });
    return NextResponse.json({ refunds: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerName = typeof body.customer_name === "string" ? body.customer_name.trim().slice(0, 200) : null;
    const customerEmail = typeof body.customer_email === "string" ? body.customer_email.trim().toLowerCase().slice(0, 254) : null;
    const amount = typeof body.amount === "number" ? body.amount : (typeof body.amount === "string" ? parseFloat(body.amount) : null);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    const supabase = getSupabase();
    const { error } = await supabase.from("refund_log").insert({
      customer_name: customerName,
      customer_email: customerEmail,
      amount: Number.isFinite(amount) ? amount : null,
      reason,
      notes,
    });
    if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
