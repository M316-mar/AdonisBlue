import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { procedure_name } = await request.json();
    if (!procedure_name || typeof procedure_name !== "string" || !procedure_name.trim()) {
      return NextResponse.json({ error: "procedure_name is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `You are an aesthetic nurse injector writing aftercare instructions for a client. Generate clear, concise post-treatment aftercare instructions for: "${procedure_name.trim()}".

Format as 6-8 bullet points (one per line, no bullet symbols — just plain text lines). Be specific to the procedure. Keep each instruction short (under 15 words). Professional tone. Do not include a heading or intro sentence — just the instructions, one per line.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await res.json();
    const instructions = data.content?.[0]?.text?.trim() ?? "";

    return NextResponse.json({ instructions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generate-aftercare] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
