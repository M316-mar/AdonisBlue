// POST  — freeze / unfreeze a nurse account (sets bots.frozen)
// DELETE — hard-delete a nurse and all related data (irreversible)

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getAuthedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  return user ?? null;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function isAdmin(userId: string) {
  const { data } = await serviceClient()
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

// ── DELETE: hard-delete nurse + all related data ───────────────────────────
export async function DELETE(request: Request) {
  try {
    const { nurse_id } = await request.json() as { nurse_id?: string };
    if (!nurse_id) return NextResponse.json({ error: "nurse_id is required" }, { status: 400 });

    const db = serviceClient();
    const errors: string[] = [];

    // Delete children first to avoid FK constraint violations
    const tables = [
      "conversations",
      "intakes",
      "treatments",
      "offers",
      "procedures",
      "bots",
      "nurses",
    ] as const;

    for (const table of tables) {
      const { error } = await db.from(table).delete().eq("nurse_id", nurse_id);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Remove the Supabase auth account last (so the nurse can't log back in
    // while DB cleanup is still running, and so we have nurse_id available above)
    const { error: authError } = await db.auth.admin.deleteUser(nurse_id);
    if (authError) errors.push(`auth: ${authError.message}`);

    if (errors.length > 0) {
      return NextResponse.json({ error: "Partial failure", details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST: freeze / unfreeze ────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { nurse_id, frozen } = await request.json();
    if (!nurse_id || typeof frozen !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("bots")
      .update({ frozen })
      .eq("nurse_id", nurse_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(nurse_id);
      const nurseEmail = authUser?.user?.email;
      if (nurseEmail) {
        resend.emails.send({
          from: "AdonisBlue <hi@adonisblue.io>",
          to: nurseEmail,
          subject: frozen ? "Your AdonisBlue account has been frozen" : "Your AdonisBlue account is active again",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a2744;">${frozen ? "Your account has been frozen" : "You're back online"}</h2>
              <p style="color: #475569;">
                ${frozen
                  ? "Your AdonisBlue account is now frozen. Clients visiting your assistant will see an \"unavailable\" message until you unfreeze your account."
                  : "Your AdonisBlue account has been unfrozen and your assistant is live again — clients can reach it as normal."}
              </p>
              <p style="color: #475569;">If this wasn't expected, contact us right away at hi@adonisblue.io.</p>
            </div>
          `,
        }).catch(() => {});
      }
    } catch {
      // Never let a notification failure affect the freeze/unfreeze action itself
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
