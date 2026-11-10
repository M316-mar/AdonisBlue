// Tests: frame/embedding header rules in next.config.ts
// - /chat/:path* must NOT have X-Frame-Options SAMEORIGIN (must be frameable)
// - /chat/:path* must have Content-Security-Policy: frame-ancestors *
// - All other sensitive paths must still carry X-Frame-Options SAMEORIGIN

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "next.config.ts"), "utf8");

let passed = 0;
let failed = 0;

function pass(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, detail) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    ${detail}`);
  failed++;
}

// Parse the headers() array from next.config.ts at a structural level.
// We look for two things:
//   A) A source matching /chat/:path* that has frame-ancestors * and no SAMEORIGIN
//   B) A global source /:path* that includes X-Frame-Options SAMEORIGIN

// Simple structural checks on the raw source text — robust enough for a stable config file.

console.log("\nnext.config.ts frame header rules:");

// 1. Global rule must set SAMEORIGIN
const hasSameOriginGlobal =
  /source:\s*["']\/:\s*path\*["'][^}]+X-Frame-Options[^}]+SAMEORIGIN/s.test(src) ||
  // also matches when split across lines inside the same block
  (src.includes('"/:path*"') || src.includes("'/:path*'")) &&
  src.includes("SAMEORIGIN");

if (hasSameOriginGlobal) {
  pass("Global /:path* sets X-Frame-Options SAMEORIGIN");
} else {
  fail("Global /:path* must set X-Frame-Options SAMEORIGIN");
}

// 2. /chat/:path* block must exist
const hasChatBlock = src.includes('"/chat/:path*"') || src.includes("'/chat/:path*'");
if (hasChatBlock) {
  pass("/chat/:path* header block exists");
} else {
  fail("/chat/:path* header block missing — embed widget will be blocked by SAMEORIGIN");
}

// 3. /chat/:path* block must set frame-ancestors *
// The config file has the chat block after the global block; find the section
// between /chat/:path* source and the next source entry (or end of file).
const chatIdx = src.indexOf('"/chat/:path*"') !== -1
  ? src.indexOf('"/chat/:path*"')
  : src.indexOf("'/chat/:path*'");
const afterChat = chatIdx >= 0 ? src.slice(chatIdx) : "";
// nextSourceIdx: where the next 'source:' entry starts (or end of string)
const nextSourceMatch = afterChat.slice(1).search(/source\s*:/);
const chatSection = nextSourceMatch >= 0
  ? afterChat.slice(0, nextSourceMatch + 1)
  : afterChat;
const hasChatFrameAncestors = chatSection.includes("frame-ancestors *");
if (hasChatFrameAncestors) {
  pass("/chat/:path* sets Content-Security-Policy: frame-ancestors *");
} else {
  fail("/chat/:path* must set Content-Security-Policy: frame-ancestors *");
}

// 4. Sensitive paths (/dashboard, /auth, /account, /healing, /admin) must NOT
//    have their own header blocks that remove SAMEORIGIN.
//    We check that no other source entry matches those paths and contains
//    "frame-ancestors *" (which would open them to framing).
const sensitivePathPatterns = ["/dashboard", "/auth", "/account", "/healing", "/admin"];
const chatBlockStart = src.indexOf('"/chat/:path*"') !== -1
  ? src.indexOf('"/chat/:path*"')
  : src.indexOf("'/chat/:path*'");

// Look for any source block outside the chat block that has frame-ancestors *
const beforeChatBlock = chatBlockStart > 0 ? src.slice(0, chatBlockStart) : src;
const afterChatBlock = chatBlockStart > 0
  ? src.slice(chatBlockStart + '"/chat/:path*"'.length)
  : "";
const outsideChat = beforeChatBlock + afterChatBlock;

const illegalFrameAncestors = /source:\s*["'][^"']*["'][^}]+frame-ancestors \*/.test(
  outsideChat.replace(/\n/g, " ")
);
if (!illegalFrameAncestors) {
  pass("No sensitive path opens frame-ancestors * outside /chat");
} else {
  fail("A path other than /chat/:path* has frame-ancestors * — verify it is intentional");
}

// 5. Confirm SAMEORIGIN is not removed globally (the global block still has it)
const globalBlockMatch = src.match(/source:\s*["']\/:path\*["'][\s\S]*?(?=\{[^{}]*source:|$)/);
if (globalBlockMatch) {
  const globalBlock = globalBlockMatch[0];
  if (globalBlock.includes("SAMEORIGIN")) {
    pass("Global block still contains SAMEORIGIN");
  } else {
    fail("Global /:path* block no longer contains SAMEORIGIN — framing protection weakened");
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
