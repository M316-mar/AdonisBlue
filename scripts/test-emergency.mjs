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
