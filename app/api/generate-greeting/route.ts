import { NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "You are helping an aesthetic nurse create a warm welcoming greeting for her AI chatbot. Generate ONLY the greeting text — start directly with the greeting, no introduction or preamble like Here is a greeting. You MUST use the exact practice name given in your response. Make it 2-3 sentences, warm and human. Include one emoji. End with a question asking how you can help today.";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 503 });
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
  const tone = typeof b.tone === "string" ? b.tone.trim() : "";

  const userMessage = [
    `Practice name (use this exact practice name in your greeting): ${practiceName || "(not provided)"}`,
    `Services offered: ${services.length > 0 ? services.join(", ") : "(none selected yet — use a warm generic welcome)"}`,
    `Tone: ${tone || "(not specified)"}`,
  ].join("\n");

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const anthropicBodyText = await anthropicRes.text();
  if (!anthropicRes.ok) {
    return NextResponse.json(
      { error: "We could not reach the AI right now. Please try again in a moment." },
      { status: 502 }
    );
  }

  const data = JSON.parse(anthropicBodyText) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const block = data.content?.find((c) => c.type === "text");
  const text = typeof block?.text === "string" ? block.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "The AI returned an empty greeting. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ greeting: text });
}
