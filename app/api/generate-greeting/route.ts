import { NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "You are helping an aesthetic nurse create a warm welcoming greeting message for her AI chatbot. Generate a short 3-4 sentence greeting that matches the tone requested. The greeting should feel human, warm, and never pushy. Include one emoji. End with a question asking how you can help today. Do not use medical jargon.";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key is not configured on the server." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const practiceName = typeof b.practiceName === "string" ? b.practiceName.trim() : "";
  const services = Array.isArray(b.services) ? b.services.filter((s): s is string => typeof s === "string") : [];
  const toneTitle = typeof b.toneTitle === "string" ? b.toneTitle.trim() : "";
  const toneTagline = typeof b.toneTagline === "string" ? b.toneTagline.trim() : "";
  const botPersonalityTone = typeof b.botPersonalityTone === "string" ? b.botPersonalityTone.trim() : "";

  const userMessage = [
    `Practice name: ${practiceName || "(not provided)"}`,
    `Services offered: ${services.length > 0 ? services.join(", ") : "(none selected yet — use a warm generic welcome)"}`,
    `Chosen tone for this greeting (from the greeting helper): ${toneTitle || "(not specified)"}`,
    toneTagline ? `Tone description: ${toneTagline}` : "",
    botPersonalityTone ? `Overall bot tone from her onboarding form: ${botPersonalityTone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!anthropicRes.ok) {
    return NextResponse.json(
      { error: "We could not reach the AI right now. Please try again in a moment." },
      { status: 502 }
    );
  }

  const data = (await anthropicRes.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const block = data.content?.find((c) => c.type === "text");
  const text = typeof block?.text === "string" ? block.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "The AI returned an empty greeting. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ greeting: text });
}
