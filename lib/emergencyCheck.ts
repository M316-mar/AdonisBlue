import { createClient } from "@supabase/supabase-js";

// ── 🔴 CALL 911 — airway, breathing, cardiac, neurological, anaphylaxis ──────
export const EMERGENCY_KEYWORDS_911 = [
  // Breathing — include common typos/truncations (breath without 'e', breathin, etc.)
  "trouble breathing", "trouble breath", "difficulty breathing",
  "hard to breathe", "hard to breath",
  "hard time breathing", "hard time breathing",
  "short of breath", "shortness of breath",
  "can't breathe", "cant breathe", "cannot breathe",
  "can't breath", "cant breath",
  "can't catch my breath", "cant catch my breath",
  "can't get air", "cant get air", "cannot get air",
  "can't get any air", "cant get any air", "cannot get any air",
  "losing my breath", "lost my breath",
  "no air", "out of air",
  // Throat / tongue / airway
  "throat swelling", "throat is swelling", "throat closing", "throat is closing",
  "tongue swelling", "tongue is swelling",
  "can't swallow", "cant swallow", "trouble swallowing",
  "throat tight", "throat feels tight", "throat is tight", "tight throat", "throat feels weird",
  // Vision / neurological
  "blurry vision", "blurred vision", "losing vision", "lost vision",
  "vision loss", "double vision", "can't see", "cant see",
  "vision", "blindness",
  // Neurological
  "face drooping", "slurred speech",
  // Cardiac
  "chest pain", "chest tight", "chest feels tight",
  // Loss of consciousness
  "fainted", "passing out", "pass out",
  // Anaphylaxis / allergic
  "allergic", "anaphylaxis",
  // They already called 911
  "911",
];

// ── 🟠 CALL NURSE — vascular, pain, infection, other urgent ──────────────────
export const EMERGENCY_KEYWORDS_NURSE = [
  // Vascular occlusion signs
  "turning white", "turning gray", "turning blue",
  "skin is white", "skin is gray", "blanching",
  "looks white", "is white", "turned white",
  "feels cold", "cold to the touch",
  "pale", "blotchy",
  "purple", "blue lips",
  // Pain
  "severe pain", "unbearable pain", "pain is unbearable",
  "extreme pain", "getting worse",
  // Infection / swelling
  "spreading redness", "high fever", "fever", "infection",
  "swelling won't stop",
  // Other urgent
  "numb", "vascular", "necrosis",
  "emergency", "hospital", "help me", "scared",
];

/** Backward-compat union — callers that only need a boolean still work. */
export const DEFAULT_EMERGENCY_KEYWORDS = [
  ...EMERGENCY_KEYWORDS_911,
  ...EMERGENCY_KEYWORDS_NURSE,
];

/** Normalize for matching: lowercase, straighten curly quotes/apostrophes, collapse spaces,
 *  and fold common two-word negations ("can not" → "cannot") so expansion works uniformly. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''ʼ`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bcan not\b/g, "cannot");
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

function matchesAny(normalized: string, keywords: string[]): boolean {
  return keywords.some((kw) => expandKeyword(kw).some((v) => normalized.includes(v)));
}

/**
 * Returns the urgency level of the message:
 *  "911"   — life-threatening: call 911 immediately
 *  "nurse" — urgent: call the nurse now
 *  null    — not an emergency
 *
 * If a message matches both levels, returns "911" (the higher level).
 * Custom keywords always fall to "nurse" level.
 */
export function detectEmergencyLevel(
  text: string,
  customKeywords: string[] = []
): "911" | "nurse" | null {
  const normalized = normalizeText(text);
  if (matchesAny(normalized, EMERGENCY_KEYWORDS_911)) return "911";
  if (matchesAny(normalized, [...EMERGENCY_KEYWORDS_NURSE, ...customKeywords])) return "nurse";
  return null;
}

/**
 * Synchronous boolean check — backward compat for callers that only need flagged/not.
 */
export function detectEmergencySync(text: string, customKeywords: string[] = []): boolean {
  return detectEmergencyLevel(text, customKeywords) !== null;
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
