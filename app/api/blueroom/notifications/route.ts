import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { blueroomAuth } from "@/lib/blueroomAuth";

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
  const auth = await blueroomAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: notifications } = await supabase
      .from("blueroom_notifications")
      .select("*")
      .eq("nurse_id", user.id)
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
  const auth = await blueroomAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("blueroom_notifications")
      .update({ is_read: true })
      .eq("nurse_id", user.id)
      .eq("is_read", false);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
