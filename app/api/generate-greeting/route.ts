import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a conversion copywriter specialising in aesthetic clinics and med-spas.
Write a short AI chatbot welcome message for an aesthetic nurse injector's practice.

Rules:
- 2-3 sentences ONLY — no more
- Use the EXACT practice name given
- Apply these psychological principles: warmth, curiosity, social proof, and a soft sense of urgency
- Sound human, not corporate — like a friendly expert who genuinely cares
- Include 1-2 tasteful emojis
- End with an open question that invites the visitor to start the conversation
- NEVER use jargon like "neural pathways" or "synergistic"
- Output ONLY the greeting text — no preamble, no "Here is a greeting:", nothing extra`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Accept both old field names (practiceName / services) and new ones (practice_name / procedures / bot_name)
  const practiceName =
    typeof b.practice_name === "string"
      ? b.practice_name.trim()
      : typeof b.practiceName === "string"
        ? b.practiceName.trim()
        : "";

  const procedures: string[] = Array.isArray(b.procedures)
    ? (b.procedures as unknown[]).filter((s): s is string => typeof s === "string")
    : Array.isArray(b.services)
      ? (b.services as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

  const botName =
    typeof b.bot_name === "string"
      ? b.bot_name.trim()
      : typeof b.botName === "string"
        ? b.botName.trim()
        : "";

  const userMessage = [
    `Practice name: ${practiceName || "(not provided — use a warm generic welcome)"}`,
    `Bot/assistant name: ${botName || "(not set)"}`,
    `Procedures offered: ${procedures.length > 0 ? procedures.join(", ") : "(not specified — keep it generic)"}`,
    "",
    "Write a compelling, unique welcome message following the rules above.",
  ].join("\n");

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "We could not reach the AI right now. Please try again in a moment." },
      { status: 502 }
    );
  }

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
    return NextResponse.json(
      { error: "The AI returned an empty response. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ greeting: text });
}
