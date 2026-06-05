import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

    const prompt = `You are an aesthetic industry intelligence analyst. Generate a briefing of the most important current trends, news, and developments in the aesthetic medicine industry that nurse injectors need to know about right now.

Focus on:
1. New or trending procedures (what clients are asking for most in 2024-2025)
2. New FDA approvals or product launches (fillers, neurotoxins, devices)
3. Safety alerts or important clinical updates
4. Business trends affecting aesthetic practices
5. Social media trends driving client demand
6. Emerging techniques plastic surgeons and dermatologists are adopting

Format your response as a JSON array of exactly 6 news items. Each item must have:
- title: short punchy headline (max 10 words)
- category: one of "trending", "new_product", "safety", "business", "technique", "social"
- summary: 2-3 sentence summary a nurse injector would find valuable
- emoji: one relevant emoji
- action: one specific thing a nurse could do with this information (max 15 words)

Return ONLY valid JSON array, no markdown, no backticks, no explanation. Start with [ and end with ]`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "[]";
    
    let news = [];
    try {
      const cleaned = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      news = JSON.parse(cleaned);
    } catch {
      news = [];
    }

    return NextResponse.json({ news, generated_at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
