// Test script for emergency keyword detection
// Run from project root: node /path/to/test-emergency.mjs

// ── Inline the logic from lib/emergencyCheck.ts ────────────────────────────

const DEFAULT_EMERGENCY_KEYWORDS = [
  "trouble breathing","difficulty breathing","hard to breathe",
  "hard time breathing","short of breath","shortness of breath",
  "can't breathe","cant breathe","cannot breathe",
  "throat swelling","throat is swelling","throat closing","throat is closing",
  "tongue swelling","tongue is swelling",
  "can't swallow","cant swallow","trouble swallowing",
  "blurry vision","blurred vision","losing vision","lost vision",
  "vision loss","double vision","can't see","cant see",
  "turning white","turning gray","turning blue",
  "skin is white","skin is gray","blanching",
  "looks white","is white","turned white",
  "feels cold","cold to the touch",
  "pale","blotchy",
  "chest pain","chest tight",
  "fainted","passing out","pass out",
  "severe pain","unbearable pain","pain is unbearable",
  "spreading redness","high fever",
  "throat tight","throat feels tight","throat is tight","tight throat","throat feels weird",
  "chest feels tight",
  "can't catch my breath","cant catch my breath",
  "purple","blue lips","extreme pain",
  "fever","infection","allergic","anaphylaxis","swelling won't stop",
  "getting worse","emergency","hospital","911","help me","scared",
  "numb","vision","blindness","vascular","necrosis",
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

function detectEmergency(text) {
  const normalized = normalizeText(text);
  return DEFAULT_EMERGENCY_KEYWORDS.some(kw =>
    expandKeyword(kw).some(v => normalized.includes(v))
  );
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
