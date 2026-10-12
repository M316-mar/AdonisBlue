import { createClient } from "@supabase/supabase-js";

export const DEFAULT_EMERGENCY_KEYWORDS = [
  "purple", "blue lips", "can't breathe", "cannot breathe", "severe pain",
  "extreme pain", "fever", "infection", "allergic", "anaphylaxis", "swelling won't stop",
  "getting worse", "emergency", "hospital", "911", "help me", "scared",
  "numb", "vision", "blindness", "vascular", "necrosis",
];

export async function checkForEmergency(
  text: string,
  nurseId: string
): Promise<{ flagged: boolean; matchedKeywords: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows } = await supabase
    .from("emergency_keywords")
    .select("keyword")
    .eq("nurse_id", nurseId);

  const allKeywords = [
    ...DEFAULT_EMERGENCY_KEYWORDS,
    ...(rows ?? []).map((r: { keyword: string }) => r.keyword),
  ];

  const lower = text.toLowerCase();
  const matchedKeywords = allKeywords.filter((kw) => lower.includes(kw.toLowerCase()));

  return { flagged: matchedKeywords.length > 0, matchedKeywords };
}
