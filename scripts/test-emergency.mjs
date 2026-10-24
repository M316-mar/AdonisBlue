// Test script for emergency keyword detection + urgency levels
// Run from project root: node scripts/test-emergency.mjs

// ── Inline the logic from lib/emergencyCheck.ts ────────────────────────────

const EMERGENCY_KEYWORDS_911 = [
  // Breathing — common typos/truncations included
  "trouble breathing","trouble breath","difficulty breathing",
  "hard to breathe","hard to breath",
  "hard time breathing",
  "short of breath","shortness of breath",
  "can't breathe","cant breathe","cannot breathe",
  "can't breath","cant breath",
  "can't catch my breath","cant catch my breath",
  "can't get air","cant get air","cannot get air",
  "can't get any air","cant get any air","cannot get any air",
  "losing my breath","lost my breath",
  "no air","out of air",
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
    .replace(/[‘’’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bcan not\b/g, "cannot");
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
  // Missing trailing ‘e’ — Maria’s exact typo ("cant breath")
  { text: "cant breath",                                             expect: true  },
  { text: "can’t breath",                                            expect: true  },
  { text: "hard to breath",                                          expect: true  },
  { text: "trouble breath",                                          expect: true  },
  // Two-word "can not" variants
  { text: "I can not breathe",                                       expect: true  },
  { text: "can not breath",                                          expect: true  },
  // "cant get air" family
  { text: "cant get air",                                            expect: true  },
  { text: "can’t get air",                                           expect: true  },
  { text: "I cannot get any air",                                    expect: true  },
  // Other common phrasings
  { text: "losing my breath",                                        expect: true  },
  { text: "im out of air",                                           expect: true  },
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

// ── Level-merge tests: 911 always wins; a later less-severe message must not downgrade ──
// Mirrors the mergedLevel logic in healing/route.ts
{
  function mergeLevel(existing, incoming) {
    if (existing === "911" || incoming === "911") return "911";
    return incoming ?? "nurse";
  }

  let mPass = 0, mFail = 0;
  const mLabel = (ok, msg) => {
    if (ok) mPass++; else mFail++;
    const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
    console.log(`${tag}  ${msg}`);
  };

  // 911 → nurse follow-up: stays 911
  const l1 = detectEmergencyLevel("I can't breathe");       // "911"
  const l2 = detectEmergencyLevel("my lip looks pale");      // "nurse"
  mLabel(mergeLevel(l1, l2) === "911", `911 → nurse follow-up: merged level stays "911"`);

  // nurse → 911 follow-up: upgrades to 911
  mLabel(mergeLevel("nurse", "911") === "911", `nurse → 911 follow-up: merged level upgrades to "911"`);

  // nurse → nurse: stays nurse
  mLabel(mergeLevel("nurse", "nurse") === "nurse", `nurse → nurse: merged level stays "nurse"`);

  // null → 911: becomes 911
  mLabel(mergeLevel(null, "911") === "911", `null → 911: merged level is "911"`);

  // null → nurse: becomes nurse
  mLabel(mergeLevel(null, "nurse") === "nurse", `null → nurse: merged level is "nurse"`);

  // Full scenario: 911 message then urgent follow-up → card stays 911
  const msg1 = "I'm having trouble breathing";   // 911
  const msg2 = "Part of my lip turned white";    // nurse
  const lvl1 = detectEmergencyLevel(msg1);
  const lvl2 = detectEmergencyLevel(msg2);
  const afterFirst  = mergeLevel(null, lvl1);   // "911"
  const afterSecond = mergeLevel(afterFirst, lvl2); // must still be "911"
  mLabel(afterSecond === "911",
    `scenario: "${msg1}" then "${msg2}" → card level stays "911"`);

  console.log(`\n${mPass}/${mPass+mFail} passed (level-merge)`);
  if (mFail > 0) process.exit(1);
}

// ── AI-path level tests: AI path must run detectEmergencyLevel, not hardcode "nurse" ──
// Mirrors the fix in healing/route.ts: aiDetectedLevel = detectEmergencyLevel(msg) ?? "nurse"
{
  let aPass = 0, aFail = 0;
  const aLabel = (ok, msg) => {
    if (ok) aPass++; else aFail++;
    const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
    console.log(`${tag}  ${msg}`);
  };

  function aiPathLevel(msg, existingLevel) {
    const detected = detectEmergencyLevel(msg) ?? "nurse";
    return (existingLevel === "911" || detected === "911") ? "911" : "nurse";
  }

  // "cant breath" via AI path → must be 911, not nurse
  aLabel(aiPathLevel("cant breath", null) === "911",
    `AI path: "cant breath" (typo) → level "911"`);

  // "cant breath" with existing 911 → stays 911
  aLabel(aiPathLevel("cant breath", "911") === "911",
    `AI path: "cant breath" + existing 911 → stays "911"`);

  // "my lip looks pale" via AI path → nurse
  aLabel(aiPathLevel("my lip looks pale", null) === "nurse",
    `AI path: "my lip looks pale" → level "nurse"`);

  // "my lip looks pale" with existing 911 → stays 911
  aLabel(aiPathLevel("my lip looks pale", "911") === "911",
    `AI path: nurse-level msg + existing 911 → stays "911"`);

  // Pure conversational message via AI path → nurse (default)
  aLabel(aiPathLevel("thank you so much", null) === "nurse",
    `AI path: non-emergency msg defaults to "nurse"`);

  console.log(`\n${aPass}/${aPass+aFail} passed (AI-path level)`);
  if (aFail > 0) process.exit(1);
}

// ── Grouping tests: merge two healing_chat rows for same intake_id ──
{
  let gPass = 0, gFail = 0;
  const gLabel = (ok, msg) => {
    if (ok) gPass++; else gFail++;
    const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
    console.log(`${tag}  ${msg}`);
  };

  // Simulate the grouping logic from assistant/context/route.ts
  function groupHealingAlerts(rows) {
    const byIntake = new Map();
    for (const r of rows) {
      const key = r.intake_id ?? r.id;
      const rowMsgs = r.alert_messages ?? [];
      const rowLevel = r.alert_level ?? null;
      const existing = byIntake.get(key);
      if (!existing) {
        byIntake.set(key, { ...r, healing_ids: [r.id], alert_messages: rowMsgs });
      } else {
        existing.healing_ids.push(r.id);
        if (rowLevel === "911" || existing.alert_level !== "911") {
          if (rowLevel === "911") existing.alert_level = "911";
          else if (!existing.alert_level && rowLevel) existing.alert_level = rowLevel;
        }
        existing.alert_messages = [...existing.alert_messages, ...rowMsgs]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (new Date(r.updated_at) > new Date(existing.updated_at)) {
          existing.updated_at = r.updated_at;
          existing.flagged_message = r.flagged_message ?? existing.flagged_message;
        }
      }
    }
    return [...byIntake.values()];
  }

  const ts1 = "2026-10-24T01:00:00.000Z";
  const ts2 = "2026-10-24T02:00:00.000Z";
  const rows = [
    { id: "row-1", intake_id: "intake-maria", alert_level: "nurse", alert_messages: [{ message: "my lip looks pale", level: "nurse", timestamp: ts1 }], flagged_message: "my lip looks pale", updated_at: ts1 },
    { id: "row-2", intake_id: "intake-maria", alert_level: "911",   alert_messages: [{ message: "cant breath", level: "911", timestamp: ts2 }], flagged_message: "cant breath", updated_at: ts2 },
  ];

  const grouped = groupHealingAlerts(rows);

  gLabel(grouped.length === 1, `grouping: 2 rows for same intake → 1 card`);
  gLabel(grouped[0]?.alert_level === "911", `grouping: merged card level is "911" (highest wins)`);
  gLabel(grouped[0]?.alert_messages?.length === 2, `grouping: merged card has 2 messages`);
  gLabel(grouped[0]?.healing_ids?.length === 2, `grouping: healing_ids contains both row ids`);
  gLabel(grouped[0]?.alert_messages?.[0]?.message === "my lip looks pale", `grouping: messages sorted oldest-first`);
  gLabel(grouped[0]?.flagged_message === "cant breath", `grouping: flagged_message from latest row`);

  // Two rows for DIFFERENT clients → two cards
  const rows2 = [
    { id: "row-a", intake_id: "intake-a", alert_level: "nurse", alert_messages: [], flagged_message: "scared", updated_at: ts1 },
    { id: "row-b", intake_id: "intake-b", alert_level: "911",   alert_messages: [], flagged_message: "cant breathe", updated_at: ts2 },
  ];
  const grouped2 = groupHealingAlerts(rows2);
  gLabel(grouped2.length === 2, `grouping: 2 rows for different intakes → 2 cards`);

  console.log(`\n${gPass}/${gPass+gFail} passed (grouping)`);
  if (gFail > 0) process.exit(1);
}
