import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "AdonisBlue2026!";
const PREVIEW_EMAIL = "preview@adonisblue.io";

export async function POST(request: Request) {
  try {
    // Verify the caller is the admin
    const secret = request.headers.get("x-admin-secret");
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: PREVIEW_EMAIL,
      options: {
        redirectTo: "https://www.adonisblue.io/dashboard",
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error("[preview-link] generateLink error:", error?.message);
      return NextResponse.json(
        { error: error?.message ?? "Failed to generate magic link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.properties.action_link });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[preview-link] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
