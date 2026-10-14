import { createClient } from "@supabase/supabase-js";

export const DEFAULT_EMERGENCY_KEYWORDS = [
  // Breathing
  "trouble breathing", "difficulty breathing", "hard to breathe",
  "hard time breathing", "short of breath", "shortness of breath",
  "can't breathe", "cant breathe", "cannot breathe",
  // Throat / tongue
  "throat swelling", "throat is swelling", "throat closing", "throat is closing",
  "tongue swelling", "tongue is swelling",
  "can't swallow", "cant swallow", "trouble swallowing",
  // Vision
  "blurry vision", "blurred vision", "losing vision", "lost vision",
  "vision loss", "double vision", "can't see", "cant see",
  // Skin color / vascular
  "turning white", "turning gray", "turning blue",
  "skin is white", "skin is gray", "blanching",
  // Cardiac / systemic
  "chest pain", "chest tight",
  "fainted", "passing out", "pass out",
  // Pain
  "severe pain", "unbearable pain", "pain is unbearable",
  // Infection / reaction
  "spreading redness", "high fever",
  // Throat tightness (common filler reaction phrase)
  "throat tight", "throat feels tight", "throat is tight", "tight throat", "throat feels weird",
  // Chest tightness variants
  "chest feels tight",
  // Breathing — catch my breath
  "can't catch my breath", "cant catch my breath",
  // Original keywords (kept)
  "purple", "blue lips",
  "extreme pain",
  "fever", "infection", "allergic", "anaphylaxis", "swelling won't stop",
  "getting worse", "emergency", "hospital", "911", "help me", "scared",
  "numb", "vision", "blindness", "vascular", "necrosis",
];

/** Normalize for matching: lowercase, straighten curly quotes/apostrophes, collapse spaces. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Curly/smart apostrophes → straight
    .replace(/[‘’ʼ`]/g, "'")
    // Curly double quotes → straight
    .replace(/[“”]/g, '"')
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/** Expand a keyword into cant/can't/cannot variants after normalizing. */
function expandKeyword(kw: string): string[] {
  const norm = normalizeText(kw);
  const out = new Set([norm]);
  if (norm.includes("can't")) {
    out.add(norm.replace(/can't/g, "cannot"));
    out.add(norm.replace(/can't/g, "cant"));
  }
  if (norm.includes("cannot")) {
    out.add(norm.replace(/cannot/g, "can't"));
    out.add(norm.replace(/cannot/g, "cant"));
  }
  if (norm.includes("cant") && !norm.includes("can't")) {
    out.add(norm.replace(/\bcant\b/g, "can't"));
    out.add(norm.replace(/\bcant\b/g, "cannot"));
  }
  return [...out];
}

/**
 * Synchronous emergency check. Used in chat and healing routes.
 * Pass customKeywords (already fetched from DB) when available.
 */
export function detectEmergencySync(text: string, customKeywords: string[] = []): boolean {
  const normalized = normalizeText(text);
  const all = [...DEFAULT_EMERGENCY_KEYWORDS, ...customKeywords];
  return all.some((kw) => expandKeyword(kw).some((v) => normalized.includes(v)));
}

/**
 * Async check — fetches nurse's custom emergency_keywords from DB.
 * Used by review/submit route.
 */
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

  const customKeywords = (rows ?? []).map((r: { keyword: string }) => r.keyword);
  const normalized = normalizeText(text);
  const allKeywords = [...DEFAULT_EMERGENCY_KEYWORDS, ...customKeywords];

  const matchedKeywords = allKeywords.filter((kw) =>
    expandKeyword(kw).some((v) => normalized.includes(v))
  );

  return { flagged: matchedKeywords.length > 0, matchedKeywords };
}
