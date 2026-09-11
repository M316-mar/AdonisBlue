import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anon.auth.getUser(token);
  return user ?? null;
}

const SYSTEM_PROMPT = `You are a warm, concise front-desk secretary for a solo aesthetic nurse. You are given a factual list of items needing attention. Summarize it naturally and briefly, in second person, addressed to the nurse. Do not add any information not in the list. Do not suggest any action beyond what's listed. If all three lists are empty, say something calm and reassuring like 'Nothing needs you right now.'`;

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

    const body = await request.json();
    const upcomingPrepReminders: any[] = Array.isArray(body.upcomingPrepReminders) ? body.upcomingPrepReminders : [];
    const flaggedIncidents: any[] = Array.isArray(body.flaggedIncidents) ? body.flaggedIncidents : [];
    const checkinsToday: any[] = Array.isArray(body.checkinsToday) ? body.checkinsToday : [];

    const userMessage = [
      upcomingPrepReminders.length > 0
        ? `Prep reminders due (next 7 days): ${upcomingPrepReminders.map(r => `${r.client_name} (${r.procedure_name}, ${r.treatment_date})`).join("; ")}`
        : "Prep reminders: none.",
      flaggedIncidents.length > 0
        ? `Flagged client messages (last 48 hours): ${flaggedIncidents.map(r => `${r.client_name ?? "Unknown"} — "${r.flagged_message ?? ""}"`).join("; ")}`
        : "Flagged messages: none.",
      checkinsToday.length > 0
        ? `Check-ins due today: ${checkinsToday.map(r => r.client_name).join(", ")}`
        : "Check-ins due today: none.",
    ].join("\n");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    }

    const data = await anthropicRes.json() as { content?: Array<{ type?: string; text?: string }> };
    const block = data.content?.find((c) => c.type === "text");
    const message = typeof block?.text === "string" ? block.text.trim() : "Nothing needs you right now.";

    // actions = the exact same real list from Step 1, unchanged — not AI-generated
    return NextResponse.json({ message, actions: upcomingPrepReminders });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
