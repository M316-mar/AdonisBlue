import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Account deletion is not configured on this server." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length).trim();

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
