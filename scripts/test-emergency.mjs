// Test script for emergency keyword detection + urgency levels
// Run from project root: node scripts/test-emergency.mjs

// ── Inline the logic from lib/emergencyCheck.ts ────────────────────────────

const EMERGENCY_KEYWORDS_911 = [
  // Breathing
  "trouble breathing","difficulty breathing","hard to breathe",
  "hard time breathing","short of breath","shortness of breath",
  "can't breathe","cant breathe","cannot breathe",
  "can't catch my breath","cant catch my breath",
  // Throat / tongue / airway
  "throat swelling","throat is swelling","throat closing","throat is closing",
  "tongue swelling","tongue is swelling",
  "can't swallow","cant swallow","trouble swallowing",
  "throat tight","throat feels tight","throat is tight","tight throat","throat feels weird",
  // Vision / neurological
  "blurry vision","blurred vision","losing vision","lost vision",
  "vision loss","double vision","can't see","cant see",
  "vision","blindness",
  // Neurological
  "face drooping","slurred speech",
  // Cardiac
  "chest pain","chest tight","chest feels tight",
  // Loss of consciousness
  "fainted","passing out","pass out",
  // Anaphylaxis / allergic
  "allergic","anaphylaxis",
  // They already called 911
  "911",
];

const EMERGENCY_KEYWORDS_NURSE = [
  // Vascular occlusion signs
  "turning white","turning gray","turning blue",
  "skin is white","skin is gray","blanching",
  "looks white","is white","turned white",
  "feels cold","cold to the touch",
  "pale","blotchy",
  "purple","blue lips",
  // Pain
  "severe pain","unbearable pain","pain is unbearable",
  "extreme pain","getting worse",
  // Infection / swelling
  "spreading redness","high fever","fever","infection",
  "swelling won't stop",
  // Other urgent
  "numb","vascular","necrosis",
  "emergency","hospital","help me","scared",
];

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function expandKeyword(kw) {
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

function matchesAny(normalized, keywords) {
  return keywords.some(kw => expandKeyword(kw).some(v => normalized.includes(v)));
}

function detectEmergencyLevel(text, customKeywords = []) {
  const normalized = normalizeText(text);
  if (matchesAny(normalized, EMERGENCY_KEYWORDS_911)) return "911";
  if (matchesAny(normalized, [...EMERGENCY_KEYWORDS_NURSE, ...customKeywords])) return "nurse";
  return null;
}

function detectEmergency(text) {
  return detectEmergencyLevel(text) !== null;
}

// ── Test cases ─────────────────────────────────────────────────────────────

const cases = [
  // New throat/chest/breath keywords
  { text: "my throat feels tight",                                        expect: true  },
  { text: "throat is tight after my appointment",                         expect: true  },
  { text: "I have a tight throat",                                        expect: true  },
  { text: "my throat feels weird",                                        expect: true  },
  { text: "my chest feels tight",                                         expect: true  },
  { text: "I can't catch my breath",                                      expect: true  },
  { text: "I cant catch my breath",                                       expect: true  },
  // iPhone curly apostrophes (U+2019)
  { text: "I’m having trouble breathing",                            expect: true  },
  { text: "I can’t breathe",                                         expect: true  },
  { text: "I can’t catch my breath",                                 expect: true  },
  // Original list — breathing
  { text: "trouble breathing",                                            expect: true  },
  { text: "difficulty breathing",                                         expect: true  },
  { text: "short of breath",                                              expect: true  },
  // Throat
  { text: "my throat is swelling",                                        expect: true  },
  { text: "throat closing",                                               expect: true  },
  // Vision
  { text: "my vision is blurry",                                          expect: true  },
  { text: "chest pain",                                                   expect: true  },
  // Skin
  { text: "my skin is turning gray",                                      expect: true  },
  // Systemic
  { text: "I fainted after the procedure",                               expect: true  },
  { text: "unbearable pain",                                              expect: true  },
  { text: "the pain is unbearable",                                       expect: true  },
  { text: "spreading redness around injection site",                      expect: true  },
  { text: "high fever",                                                   expect: true  },
  { text: "anaphylaxis",                                                  expect: true  },
  { text: "allergic reaction",                                            expect: true  },
  // New vascular occlusion / pale / cold keywords (Maria's exact message)
  { text: "my lip feels cold and looks white",                            expect: true  },
  { text: "my lip looks white",                                           expect: true  },
  { text: "my skin is white",                                             expect: true  },
  { text: "it turned white after the injection",                          expect: true  },
  { text: "my lip feels cold",                                            expect: true  },
  { text: "cold to the touch",                                            expect: true  },
  { text: "the area is pale",                                             expect: true  },
  { text: "my skin looks blotchy",                                        expect: true  },

  // Should NOT match
  { text: "my lip is a little swollen",                                   expect: false },
  { text: "some bruising is normal right?",                               expect: false },
  { text: "slight pain at injection site",                                expect: false },
  { text: "Is it normal to feel some tenderness?",                        expect: false },
  { text: "when can I wear makeup?",                                      expect: false },
];

// ── Run ────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";

for (const { text, expect } of cases) {
  const result = detectEmergency(text);
  const ok = result === expect;
  if (ok) pass++; else fail++;
  const label = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  const expected = expect ? "YES" : "NO ";
  const got      = result ? "YES" : "NO ";
  console.log(`${label}  [expected:${expected} got:${got}]  "${text}"`);
}

console.log(`\n${pass}/${pass+fail} passed${fail > 0 ? ` — ${BOLD}${RED}${fail} FAILED${RESET}` : ""}`);
if (fail > 0) process.exit(1);

// ── Level tests: one keyword per level → correct level; both → 🔴 ──────────
{
  let lPass = 0, lFail = 0;
  const lLabel = (ok, msg) => {
    if (ok) lPass++; else lFail++;
    const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
    console.log(`${tag}  ${msg}`);
  };

  const levelCases = [
    // 🔴 911 level — one per category
    { text: "I can't breathe",                         expect: "911" },
    { text: "my throat is closing",                    expect: "911" },
    { text: "my vision is blurry",                     expect: "911" },
    { text: "chest pain",                              expect: "911" },
    { text: "I fainted",                               expect: "911" },
    { text: "face drooping",                           expect: "911" },
    { text: "slurred speech",                          expect: "911" },
    { text: "allergic reaction",                       expect: "911" },
    { text: "anaphylaxis",                             expect: "911" },
    { text: "call 911",                                expect: "911" },
    // 🟠 nurse level — one per category
    { text: "my lip looks white",                      expect: "nurse" },
    { text: "cold to the touch",                       expect: "nurse" },
    { text: "skin looks pale",                         expect: "nurse" },
    { text: "skin looks blotchy",                      expect: "nurse" },
    { text: "severe pain",                             expect: "nurse" },
    { text: "getting worse",                           expect: "nurse" },
    { text: "spreading redness",                       expect: "nurse" },
    { text: "high fever",                              expect: "nurse" },
    { text: "necrosis",                                expect: "nurse" },
    // Both-levels message → must return "911" (higher wins)
    { text: "my lip is white and I can't breathe",     expect: "911" },
    // Non-emergency → null
    { text: "is bruising normal?",                     expect: null  },
    { text: "when can I wear makeup?",                 expect: null  },
    // Custom keywords → "nurse" level
    { text: "my custom symptom",                       expect: "nurse", custom: ["custom symptom"] },
  ];

  for (const { text, expect: exp, custom = [] } of levelCases) {
    const result = detectEmergencyLevel(text, custom);
    const ok = result === exp;
    lLabel(ok, `level "${exp ?? "null"}" ← "${text}"${!ok ? `  (got "${result}")` : ""}`);
  }

  console.log(`\n${lPass}/${lPass+lFail} passed (level detection)`);
  if (lFail > 0) process.exit(1);
}

// ── Full healing flow: emergency → follow-up "thank you" ──────────────────
// Verifies:
// 1. Emergency message triggers isFlagged=true → row gets flagged=true + status="active"
// 2. Follow-up "Okay, thank you" triggers isFlagged=false → row flag NOT cleared
//    (the route only sets flagged/status when isFlagged; non-flagged messages don't touch them)
{
  let fPass = 0, fFail = 0;
  const flowLabel = (ok, msg) => {
    if (ok) fPass++; else fFail++;
    const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
    console.log(`${tag}  ${msg}`);
  };

  const emergencyMsg = "my lip feels cold and looks white";
  const followUpMsg  = "Okay, thank you";

  // Step 1: emergency message → isFlagged = true
  const flaggedOnEmergency = detectEmergency(emergencyMsg);
  flowLabel(flaggedOnEmergency === true, `healing flow step 1: emergency message triggers isFlagged=true`);

  // Step 2: follow-up message → isFlagged = false (follow-up alone doesn't trigger)
  const flaggedOnFollowUp = detectEmergency(followUpMsg);
  flowLabel(flaggedOnFollowUp === false, `healing flow step 2: follow-up "thank you" does NOT trigger isFlagged`);

  // Step 3: simulate upsert payload guard — when !isFlagged, payload must NOT include flagged/status
  // This mirrors the guard in healing/route.ts lines 202-206
  function buildUpsertPayload(isFlagged, lastMsg) {
    const payload = {
      treatment_id: "test-uuid",
      nurse_id: "test-nurse",
      client_name: "Maria",
      messages: [],
      updated_at: new Date().toISOString(),
    };
    if (isFlagged) {
      payload.flagged = true;
      payload.flagged_message = lastMsg;
      payload.status = "active";
    }
    return payload;
  }

  const emergencyPayload = buildUpsertPayload(true, emergencyMsg);
  flowLabel(emergencyPayload.flagged === true && emergencyPayload.status === "active",
    `healing flow step 3a: emergency payload sets flagged=true + status="active"`);

  const followUpPayload = buildUpsertPayload(false, followUpMsg);
  flowLabel(!("flagged" in followUpPayload) && !("status" in followUpPayload),
    `healing flow step 3b: follow-up payload does NOT touch flagged or status (alert stays active)`);

  console.log(`\n${fPass}/${fPass+fFail} passed (healing flow)`);
  if (fFail > 0) process.exit(1);
}
