import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface NotificationRow {
  id: string;
  nurse_id: string;
  type: string;
  post_id: string | null;
  post_title: string | null;
  actor_name: string | null;
  is_read: boolean;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nurse_id = searchParams.get("nurse_id");

    if (!nurse_id) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: notifications } = await supabase
      .from("blueroom_notifications")
      .select("*")
      .eq("nurse_id", nurse_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (notifications ?? []) as NotificationRow[];
    const unread_count = rows.filter(n => !n.is_read).length;

    return NextResponse.json({ notifications: rows, unread_count });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { nurse_id?: string };
    const { nurse_id } = body;

    if (!nurse_id) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("blueroom_notifications")
      .update({ is_read: true })
      .eq("nurse_id", nurse_id)
      .eq("is_read", false);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
