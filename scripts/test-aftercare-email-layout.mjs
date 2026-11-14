/**
 * Tests for buildAftercareEmail and previewSentences.
 * Run: node scripts/test-aftercare-email-layout.mjs
 */

import { buildAftercareEmail, previewSentences } from "../lib/buildAftercareEmail.ts";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

const SITE = "https://adonisblue.io";
const TREATMENT_ID = "abc123";

// ── previewSentences ─────────────────────────────────────────────────────────
console.log("\npreviewSentences");

{
  const text = "Avoid sun exposure for 48 hours. Do not touch the treated area. Rest and hydrate well.";
  const preview = previewSentences(text, 2);
  assert(
    preview === "Avoid sun exposure for 48 hours. Do not touch the treated area.",
    "cuts at 2nd sentence boundary"
  );
  assert(!preview.includes("Rest"), "does not include 3rd sentence");
}

{
  const text = "Take it easy today! Avoid strenuous activity? Drink plenty of water.";
  const preview = previewSentences(text, 2);
  assert(
    preview.endsWith("!") || preview.endsWith("?"),
    "cuts at sentence-ending punctuation (! or ?)"
  );
  assert(!preview.endsWith("…"), "no ellipsis when sentence boundary found");
}

{
  const text = "No sentence boundary here, just a long paragraph of text with no punctuation at all";
  const preview = previewSentences(text, 2);
  assert(preview.length <= 201, "falls back to word boundary truncation");
  assert(!preview.includes(",just"), "never cuts mid-word");
}

// ── buildAftercareEmail — single procedure ───────────────────────────────────
console.log("\nbuildAftercareEmail — 1 procedure");

{
  const html = buildAftercareEmail({
    clientFirstName: "Maria",
    escapedPracticeName: "Glow Studio",
    treatmentId: TREATMENT_ID,
    procedures: [
      {
        name: "Lip Filler",
        contentHtml: "<p>Avoid pressure. Stay hydrated.</p>",
        tabParam: "Lip%20Filler",
      },
    ],
    nurseFirstName: "Ana",
    nursePhone: "555-1234",
    siteUrl: SITE,
  });

  assert(html.includes("Hi Maria!"), "greeting uses first name");
  assert(html.includes("💙") || html.includes("&#x1F499") || html.includes("\u{1F499}"), "greeting has 💙");
  assert(html.includes("Here are your aftercare tips"), "subtext present");
  assert(html.includes("Questions? Chat with us anytime"), "chat button near top");
  assert(html.includes(`${SITE}/healing/${TREATMENT_ID}`), "chat button links to healing page");
  assert(html.includes("Avoid pressure"), "full content in body (not a card)");
  // Should NOT be a compact card layout for single procedure
  assert(!html.includes("See full aftercare"), "no card layout for single procedure");
  assert(html.includes("If anything feels wrong, contact Ana right away"), "emergency line present");
  assert(html.includes("at 555-1234"), "phone in emergency line");
  assert(html.includes("call 911"), "911 in emergency line");
}

// ── buildAftercareEmail — no first name ─────────────────────────────────────
console.log("\nbuildAftercareEmail — no first name");

{
  const html = buildAftercareEmail({
    clientFirstName: "",
    escapedPracticeName: "Glow Studio",
    treatmentId: TREATMENT_ID,
    procedures: [{ name: "Botox", contentHtml: "<p>Rest.</p>", tabParam: "Botox" }],
    nurseFirstName: "Ana",
    nursePhone: "",
    siteUrl: SITE,
  });

  assert(html.includes("Hi there!"), "falls back to 'Hi there!' when no first name");
  assert(!html.includes("right away at"), "no phone in emergency line when phone is empty");
}

// ── buildAftercareEmail — 2 procedures ───────────────────────────────────────
console.log("\nbuildAftercareEmail — 2 procedures");

{
  const html = buildAftercareEmail({
    clientFirstName: "Sara",
    escapedPracticeName: "Glow Studio",
    treatmentId: TREATMENT_ID,
    procedures: [
      {
        name: "Lip Filler",
        contentHtml: "Avoid pressure. Stay hydrated. Sleep elevated for 24 hours.",
        tabParam: "Lip%20Filler",
      },
      {
        name: "Botox",
        contentHtml: "Do not rub the area. Avoid lying down for 4 hours. Skip exercise today.",
        tabParam: "Botox",
      },
    ],
    nurseFirstName: "Ana",
    nursePhone: "555-9876",
    siteUrl: SITE,
  });

  assert(html.includes("Lip Filler"), "first procedure name in card");
  assert(html.includes("Botox"), "second procedure name in card");
  assert(html.includes("See full aftercare"), "card layout has 'See full aftercare' link");
  // Verify tab links include ?tab= parameter
  assert(
    html.includes(`/healing/${TREATMENT_ID}?tab=Lip%20Filler`),
    "first card links to ?tab=Lip%20Filler"
  );
  assert(
    html.includes(`/healing/${TREATMENT_ID}?tab=Botox`),
    "second card links to ?tab=Botox"
  );
  // Preview — should show partial content, not full
  assert(!html.includes("Skip exercise today"), "full content not visible in card preview");
  // Chat button at top
  const chatTopIdx = html.indexOf("Questions? Chat with us anytime");
  const firstCardIdx = html.indexOf("Lip Filler");
  assert(chatTopIdx < firstCardIdx, "chat button appears before first card");
  // Emergency line
  assert(html.includes("If anything feels wrong"), "emergency line present in multi-procedure email");
  // Bottom chat
  assert(html.indexOf("Open recovery chat") > html.indexOf("If anything feels wrong"), "chat button also at bottom");
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
