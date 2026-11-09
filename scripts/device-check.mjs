/**
 * Device-check: runs Playwright against the dev server and checks every screen at
 * 3 viewport sizes for common mobile-UX failures.
 *
 * Logged-out screens run in TWO states per viewport:
 *   • first-visit  — no cookie consent in localStorage (banner is visible)
 *   • returning    — adonisblue_cookie_consent=true (banner dismissed)
 * In CI (--ci flag) only the first-visit state is tested (no credentials available).
 *
 * Logged-in screens require TEST_NURSE_EMAIL + TEST_NURSE_PASSWORD in .env.local;
 * if either is absent the script skips them with a warning (does not fail).
 * Logged-in screens are tested only in the "returning" state (the nurse has consented).
 *
 * Usage:
 *   node scripts/device-check.mjs            # all screens (uses dev server on :3000)
 *   node scripts/device-check.mjs --ci       # logged-out screens, first-visit only (CI-safe)
 *
 * Failure conditions per screen × viewport × state:
 *   1. Horizontal scrolling (scrollWidth > clientWidth on <body>)
 *   2. Any element wider than the viewport
 *   3. Any visible button/link/input/select/textarea with hit area < 44×44 px
 *   4. Any interactive element that remains covered after scrolling it to the
 *      centre of the viewport (simulates a user scrolling to reach the element)
 *   5. Any visible <input>/<textarea> with computed font-size < 16px
 *   6. The primary submit button is disabled AND no sibling/nearby reason text is visible
 *   7. Visible text element overlapped/covered by an unrelated element (text-on-text,
 *      button-on-text, icon-on-text) — excludes ARIA modals, data-overlay-ok, data-decorative
 *   8. Text content overflows its container without intentional ellipsis or scrollability
 *      (scrollWidth > clientWidth on a text-bearing element)
 *   9. Flex row with flex-wrap:nowrap where a child is pushed off-screen / outside the container
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CI_MODE = process.argv.includes("--ci");
const BASE_URL = process.env.DEVICE_CHECK_BASE_URL ?? "http://localhost:3000";

// ── Load credentials from .env.local ──────────────────────────────────────────
let testEmail = "";
let testPassword = "";
let adminEmails = [];
let supabaseUrl = "";
let supabaseAnonKey = "";
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const [k, ...rest] = line.split("=");
    const v = rest.join("=").trim();
    if (k?.trim() === "TEST_NURSE_EMAIL") testEmail = v;
    if (k?.trim() === "TEST_NURSE_PASSWORD") testPassword = v;
    if (k?.trim() === "ADMIN_EMAILS") adminEmails = v.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    if (k?.trim() === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = v;
    if (k?.trim() === "NEXT_PUBLIC_SUPABASE_ANON_KEY") supabaseAnonKey = v;
  }
}

/** Fetch a treatment ID for the test nurse directly from the API (Node.js side, no browser).
 *  Tries active treatments first, then archived. Returns null if none found. */
async function fetchTestTreatmentId() {
  if (!supabaseUrl || !supabaseAnonKey || !testEmail || !testPassword) return null;
  try {
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await sb.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (error || !data?.session?.access_token) return null;
    const token = data.session.access_token;
    const headers = { Authorization: `Bearer ${token}` };
    // Active first
    const r1 = await fetch(`${BASE_URL}/api/treatments`, { headers });
    if (r1.ok) {
      const j1 = await r1.json();
      const id = j1.treatments?.[0]?.id ?? null;
      if (id) return id;
    }
    // Archived fallback
    const r2 = await fetch(`${BASE_URL}/api/treatments?archived=true`, { headers });
    if (r2.ok) {
      const j2 = await r2.json();
      return j2.treatments?.[0]?.id ?? null;
    }
  } catch { /* fall through */ }
  return null;
}
/** Archive device-check test treatments via the API (not UI clicks).
 *  If treatmentId is given, archives only that one.
 *  Otherwise fetches all active treatments and archives any with notes containing "device-check test". */
async function archiveDeviceCheckTreatments(treatmentId) {
  if (!supabaseUrl || !supabaseAnonKey || !testEmail || !testPassword) return 0;
  try {
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await sb.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (error || !data?.session?.access_token) return 0;
    const token = data.session.access_token;
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const ids = [];
    if (treatmentId) {
      ids.push(treatmentId);
    } else {
      const r = await fetch(`${BASE_URL}/api/treatments`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const j = await r.json();
        for (const t of j.treatments ?? []) {
          if (typeof t.notes === "string" && t.notes.includes("device-check test")) ids.push(t.id);
        }
      }
    }

    let count = 0;
    for (const id of ids) {
      const r = await fetch(`${BASE_URL}/api/treatments`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ treatment_id: id, action: "archive" }),
      });
      if (r.ok) count++;
    }
    return count;
  } catch { return 0; }
}

const hasCredentials = !!(testEmail && testPassword);

// Rule 10: TEST_NURSE_EMAIL must not be an admin email.
if (hasCredentials && adminEmails.includes(testEmail.toLowerCase())) {
  process.stderr.write(`\nERROR: TEST_NURSE_EMAIL (${testEmail}) is listed in ADMIN_EMAILS.\n`);
  process.stderr.write(`Logged-in device-check must not run as an admin. Use a non-admin test account.\n`);
  process.exit(1);
}

// ── Viewports ──────────────────────────────────────────────────────────────────
const VIEWPORTS = [
  { label: "iPhone mini 320", width: 320, height: 568 },
  { label: "Android 360",     width: 360, height: 740 },
  { label: "iPhone SE 375",   width: 375, height: 667 },
  { label: "iPhone 390",      width: 390, height: 844 },
  { label: "iPad 820",        width: 820, height: 1180 },
  { label: "Laptop 1440",     width: 1440, height: 900 },
];

// ── Visit states for logged-out screens ───────────────────────────────────────
// CI runs first-visit only (no need to test returning state without credentials).
const LOGGED_OUT_STATES = CI_MODE
  ? [{ label: "first-visit", cookieConsented: false }]
  : [
      { label: "first-visit", cookieConsented: false },
      { label: "returning", cookieConsented: true },
    ];

// ── Screens ────────────────────────────────────────────────────────────────────
// loggedIn: false = run everywhere; true = requires credentials, skip in CI
const SCREENS = [
  // Logged-out
  { path: "/", label: "Homepage", loggedIn: false },
  { path: "/auth", label: "Auth", loggedIn: false },
  { path: "/beta", label: "Beta", loggedIn: false },
  { path: "/referrals", label: "Referrals", loggedIn: false },
  { path: "/chat/demo", label: "Chat (slug)", loggedIn: false },
  // Logged-in
  { path: "/dashboard", label: "Dashboard", loggedIn: true },
  { path: "/onboarding", label: "Onboarding", loggedIn: true },
  { path: "/aftercare", label: "Log (Treatment Records)", loggedIn: true },
  { path: "/checkin", label: "Check-Ins", loggedIn: true },
  { path: "/client-journey", label: "Emails", loggedIn: true },
  { path: "/offers", label: "Offers", loggedIn: true },
  { path: "/ask", label: "Alerts", loggedIn: true },
  { path: "/account", label: "My Account", loggedIn: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Checks run inside the browser page via page.evaluate(). Returns array of issue strings. */
async function runChecks(page, viewport) {
  return page.evaluate((vw) => {
    const issues = [];
    const body = document.body;

    // 1. Horizontal scrolling
    if (body.scrollWidth > body.clientWidth + 2) {
      issues.push(`Horizontal scroll: body.scrollWidth=${body.scrollWidth} > clientWidth=${body.clientWidth}`);
    }

    // 2. Element wider than viewport (skip elements explicitly marked as decorative)
    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      if (el.hasAttribute("data-decorative")) continue; // explicitly marked decorative
      const r = el.getBoundingClientRect();
      if (r.width > vw + 2 && r.left < vw && r.right > vw + 2) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className?.toString().slice(0, 60) ?? "";
        issues.push(`Element wider than viewport: <${tag} class="${cls}"> width=${Math.round(r.width)}`);
        break; // report first only to avoid spam
      }
    }

    // 3½. Scrollable tab bar: first tab must be fully visible at load (scrollLeft === 0)
    // Must run before rules 4 and 7 which call scrollIntoView and change scrollLeft.
    {
      const scrollables = Array.from(document.querySelectorAll("*")).filter(el => {
        const st = window.getComputedStyle(el);
        return (st.overflowX === "auto" || st.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2;
      });
      for (const bar of scrollables) {
        if (bar.scrollLeft > 4) {
          const cls = bar.className?.toString().slice(0, 60) ?? "";
          issues.push(`Tab bar scrolled on load: <${bar.tagName.toLowerCase()} class="${cls}"> scrollLeft=${bar.scrollLeft} (first tab may be hidden)`);
        }
      }
    }

    // 3. Tap-target size < 44×44 px
    const interactive = Array.from(document.querySelectorAll("button, a, input, select, textarea"));
    for (const el of interactive) {
      // Skip hidden elements
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // Allow inputs that are not interactive UI controls (hidden inputs)
      if (el.tagName === "INPUT" && (el.type === "hidden" || el.type === "checkbox" || el.type === "radio")) continue;
      if (r.width < 44 || r.height < 44) {
        const id = el.id ? `#${el.id}` : "";
        const text = (el.textContent ?? "").trim().slice(0, 40);
        const type = el.tagName === "INPUT" ? ` type="${el.type}"` : "";
        issues.push(`Tap target <${el.tagName.toLowerCase()}${type}${id}> "${text}" is ${Math.round(r.width)}×${Math.round(r.height)}px (need 44×44)`);
      }
    }

    // 4. Interactive element covered by another element.
    // Each element is scrolled to the centre of the viewport first — this simulates
    // a real user scrolling to reach it. If anything still covers it after that scroll,
    // it is truly inaccessible.
    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r0 = el.getBoundingClientRect();
      if (r0.width === 0 || r0.height === 0) continue;

      // Scroll element to viewport centre so we test reachability, not initial position.
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });

      // Re-read rect after scroll.
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // After scrollIntoView the element should be in the viewport; skip if not.
      if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) continue;

      const top = document.elementFromPoint(cx, cy);
      if (!top) continue;
      if (top !== el && !el.contains(top) && !top.contains(el)) {
        // Skip if the covering element is part of an ARIA modal/dialog —
        // a dialog legitimately obscures everything behind it.
        let node = top;
        let skip = false;
        while (node) {
          const role = node.getAttribute?.("role");
          const modal = node.getAttribute?.("aria-modal");
          if (role === "dialog" || modal === "true") { skip = true; break; }
          node = node.parentElement;
        }
        // Skip nextjs dev-portal (dev-mode artifact, not present in production)
        if (top.tagName?.toLowerCase() === "nextjs-portal") skip = true;
        if (skip) continue;

        const covTag = top.tagName.toLowerCase();
        const covCls = top.className?.toString().slice(0, 60) ?? "";
        const text = (el.textContent ?? "").trim().slice(0, 40);
        issues.push(`Interactive <${el.tagName.toLowerCase()}> "${text}" covered by <${covTag} class="${covCls}">`);
      }
    }

    // 5. Input font-size < 16px (triggers iOS zoom)
    const textInputs = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea"));
    for (const el of textInputs) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const fs = parseFloat(style.fontSize);
      if (fs < 16) {
        const ph = el.placeholder ? ` placeholder="${el.placeholder.slice(0, 30)}"` : "";
        issues.push(`Input${ph} font-size=${fs}px < 16px (triggers iOS zoom)`);
      }
    }

    // 6. Disabled submit button with no visible reason text
    const submits = Array.from(document.querySelectorAll("button[disabled]")).filter(b => {
      const t = (b.textContent ?? "").toLowerCase();
      return t.includes("log") || t.includes("save") || t.includes("submit") || t.includes("send") || t.includes("next") || t.includes("approve");
    });
    for (const btn of submits) {
      // Look for a sibling or nearby <p>/<span> that explains why
      const parent = btn.parentElement;
      if (!parent) continue;
      const siblings = Array.from(parent.querySelectorAll("p, span, div"));
      const hasReason = siblings.some(s => {
        const style = window.getComputedStyle(s);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const t = (s.textContent ?? "").trim();
        return t.length > 5 && t.length < 200;
      });
      if (!hasReason) {
        const text = (btn.textContent ?? "").trim().slice(0, 40);
        issues.push(`Disabled submit button "${text}" has no visible reason text nearby`);
      }
    }

    // 7. Visible text overlapped by an unrelated element (text-on-text, button-on-text, etc.)
    const textBearers = Array.from(document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, span, label, td, th, li"))
      .filter(el => {
        if (el.hasAttribute("data-decorative") || el.hasAttribute("data-overlay-ok")) return false;
        const st = window.getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const ownText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent ?? "").join("").trim();
        return ownText.length >= 2;
      }).slice(0, 60);

    for (const el of textBearers) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) continue;
      const top = document.elementFromPoint(cx, cy);
      if (!top || top === el || el.contains(top) || top.contains(el)) continue;
      let skip = false;
      let node = top;
      while (node) {
        const role = node.getAttribute?.("role");
        const modal = node.getAttribute?.("aria-modal");
        if (role === "dialog" || modal === "true") { skip = true; break; }
        if (node.hasAttribute?.("data-overlay-ok") || node.hasAttribute?.("data-decorative")) { skip = true; break; }
        node = node.parentElement;
      }
      if (top.tagName?.toLowerCase() === "nextjs-portal") skip = true;
      if (skip) continue;
      const ownText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent ?? "").join("").trim().slice(0, 30);
      const covTag = top.tagName.toLowerCase();
      const covCls = top.className?.toString().slice(0, 50) ?? "";
      issues.push(`Text "${ownText}" overlapped by <${covTag} class="${covCls}">`);
    }

    // 8. Text content overflowing container without intentional truncation or scrollability
    const textContainers = Array.from(document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, span, td, th, label, li"))
      .filter(el => {
        const st = window.getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        return (el.textContent ?? "").trim().length >= 3;
      }).slice(0, 100);

    const reported8 = new Set();
    for (const el of textContainers) {
      if (el.scrollWidth <= el.clientWidth + 2) continue;
      const st = window.getComputedStyle(el);
      if (st.textOverflow === "ellipsis") continue;
      if (st.overflowX === "auto" || st.overflowX === "scroll") continue;
      const ownText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent ?? "").join("").trim();
      if (!ownText) continue;
      const key = `${el.tagName}:${ownText.slice(0, 30)}`;
      if (reported8.has(key)) continue;
      reported8.add(key);
      issues.push(`Text cut off: <${el.tagName.toLowerCase()}> "${ownText.slice(0, 40)}" scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}`);
    }

    // 9. Flex row with nowrap where a child is pushed off-screen
    const reported9 = new Set();
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const st = window.getComputedStyle(el);
      if (st.display !== "flex" && st.display !== "inline-flex") continue;
      if (st.flexWrap !== "nowrap") continue;
      const dir = st.flexDirection;
      if (dir === "column" || dir === "column-reverse") continue;
      // Skip scrollable containers — children legitimately extend beyond bounds
      if (st.overflowX === "auto" || st.overflowX === "scroll") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      for (const child of Array.from(el.children)) {
        // Skip hidden children — getBoundingClientRect() returns {0,0,0,0} for display:none,
        // which triggers false positives when the container is positioned away from origin.
        const childSt = window.getComputedStyle(child);
        if (childSt.display === "none" || childSt.visibility === "hidden") continue;
        const cr = child.getBoundingClientRect();
        if (cr.width === 0 && cr.height === 0) continue;
        if (cr.right > r.right + 4 || cr.left < r.left - 4) {
          const cls = el.className?.toString().slice(0, 50) ?? "";
          const key = `${el.tagName}:${cls.slice(0, 30)}`;
          if (reported9.has(key)) continue;
          reported9.add(key);
          const childText = (child.textContent ?? "").trim().slice(0, 30);
          issues.push(`Flex row overflow: <${el.tagName.toLowerCase()} class="${cls}"> child "${childText}" outside container`);
          break;
        }
      }
    }

    return issues;
  }, viewport.width);
}

// ── Sign in ───────────────────────────────────────────────────────────────────
async function signIn(page) {
  await page.goto(`${BASE_URL}/auth`, { waitUntil: "networkidle" });
  // Switch to login tab if needed
  const loginTab = page.locator("button", { hasText: /log in/i }).first();
  if (await loginTab.isVisible()) await loginTab.click();

  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /auth
  try {
    await page.waitForURL(url => !url.pathname.startsWith("/auth"), { timeout: 10_000 });
  } catch {
    // might already be on dashboard
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
let totalIssues = 0;
let totalScreens = 0;

const browser = await chromium.launch({ headless: true });

// Healing chat is tested AFTER the interaction test (which creates+archives a treatment).
// See the healing chat section near the end of the script.

try {
  for (const vp of VIEWPORTS) {
    // ── Logged-out screens: run in each visit state ──────────────────────────
    for (const visitState of LOGGED_OUT_STATES) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: vp.width < 768
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          : undefined,
        isMobile: vp.width < 768,
      });

      for (const screen of SCREENS) {
        if (screen.loggedIn) continue; // logged-in screens handled separately below

        totalScreens++;
        const page = await context.newPage();

        if (visitState.cookieConsented) {
          await page.addInitScript(() => {
            try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
          });
        }

        try {
          await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: "networkidle", timeout: 20_000 });
          // Brief pause for client-side rendering (cookie banner useEffect) to settle
          await page.waitForTimeout(500);

          const issues = await runChecks(page, vp);
          const label = `${vp.label} [${visitState.label}] — ${screen.label}`;
          if (issues.length > 0) {
            process.stdout.write(`\n❌ ${label} (${BASE_URL}${screen.path})\n`);
            for (const iss of issues) {
              process.stdout.write(`   • ${iss}\n`);
              totalIssues++;
            }
          } else {
            process.stdout.write(`  ✓ ${label}\n`);
          }
        } catch (e) {
          process.stdout.write(`  ⚠ ${vp.label} [${visitState.label}] — ${screen.label}: ${e.message}\n`);
        }
        await page.close();
      }

      await context.close();
    }

    // ── Logged-in screens: returning state only, skip in CI or without creds ──
    if (!CI_MODE && hasCredentials) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: vp.width < 768
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          : undefined,
        isMobile: vp.width < 768,
      });

      // Set cookie consent for the signed-in context
      const setupPage = await context.newPage();
      await setupPage.addInitScript(() => {
        try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
      });

      let isSignedIn = false;
      try {
        await signIn(setupPage);
        isSignedIn = true;
      } catch (e) {
        process.stderr.write(`  ⚠ Sign-in failed at ${vp.label}: ${e.message}\n`);
      }
      await setupPage.close();

      if (isSignedIn) {
        for (const screen of SCREENS) {
          if (!screen.loggedIn) continue;

          totalScreens++;
          const page = await context.newPage();
          await page.addInitScript(() => {
            try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
          });

          try {
            await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: "networkidle", timeout: 20_000 });
            if (page.url().includes("/auth")) {
              process.stderr.write(`  ⚠ "${screen.label}" redirected to /auth — session may have expired\n`);
              await page.close();
              continue;
            }
            await page.waitForTimeout(500);

            const issues = await runChecks(page, vp);
            const label = `${vp.label} [returning] — ${screen.label}`;
            if (issues.length > 0) {
              process.stdout.write(`\n❌ ${label} (${BASE_URL}${screen.path})\n`);
              for (const iss of issues) {
                process.stdout.write(`   • ${iss}\n`);
                totalIssues++;
              }
            } else {
              process.stdout.write(`  ✓ ${label}\n`);
            }
          } catch (e) {
            process.stdout.write(`  ⚠ ${vp.label} [returning] — ${screen.label}: ${e.message}\n`);
          }
          await page.close();
        }
      }

      await context.close();
    } else if (!CI_MODE && !hasCredentials) {
      process.stderr.write(`  ⚠ Skipping logged-in screens at ${vp.label} — TEST_NURSE_EMAIL/TEST_NURSE_PASSWORD not set\n`);
    }
  }
  // ── Interaction test: Log + "Plan her return" state at all mobile viewports ──
  // Opens the form in the Plan-her-return expanded state and runs layout checks
  // WITHOUT submitting — no DB write, no email risk.
  if (!CI_MODE && hasCredentials) {
    const mobileVps = VIEWPORTS.filter(v => v.width < 768);
    for (const vp of mobileVps) {
      process.stdout.write(`\n── Interaction state: Log+Plan (${vp.label}) ──\n`);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        isMobile: true,
      });
      const pg = await ctx.newPage();
      await pg.addInitScript(() => {
        try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
      });
      try {
        await signIn(pg);
        await pg.goto(`${BASE_URL}/aftercare`, { waitUntil: "networkidle", timeout: 20_000 });
        await pg.waitForTimeout(800);

        // Open the Log form
        const logBtn = pg.locator("button", { hasText: /Log a treatment/i }).first();
        await logBtn.waitFor({ state: "visible", timeout: 5_000 });
        await logBtn.click();
        await pg.waitForTimeout(400);

        // Switch to Walk-in tab
        const walkinTab = pg.locator("button", { hasText: /Walk.in/i }).first();
        await walkinTab.waitFor({ state: "visible", timeout: 3_000 });
        await walkinTab.click();
        await pg.waitForTimeout(200);

        // Fill name so the form is populated
        await pg.fill('input[placeholder="Client name"]', "Device Check Test");

        // Select a procedure
        const procBtns = pg.locator("button").filter({ hasText: /botox|filler|micro|nose|skin|tear/i });
        const procCount = await procBtns.count();
        if (procCount > 0) {
          await procBtns.first().waitFor({ state: "visible", timeout: 5_000 });
          await procBtns.first().click();
          await pg.waitForTimeout(300);
        }

        // Expand "Plan her return" section
        const planBtn = pg.locator("button, label").filter({ hasText: /Plan her return/i }).first();
        const planCount = await planBtn.count();
        if (planCount > 0) {
          await planBtn.waitFor({ state: "visible", timeout: 3_000 });
          await planBtn.click();
          await pg.waitForTimeout(400);
        }

        // Run layout checks in this open form state
        const issues = await runChecks(pg, vp);
        const label = `${vp.label} [returning] — Log (Plan her return open)`;
        if (issues.length > 0) {
          process.stdout.write(`\n❌ ${label}\n`);
          for (const iss of issues) {
            process.stdout.write(`   • ${iss}\n`);
            totalIssues++;
          }
        } else {
          process.stdout.write(`  ✓ ${label}\n`);
        }
      } catch (e) {
        process.stdout.write(`  ⚠ Log+Plan interaction state failed at ${vp.label}: ${e.message}\n`);
      }
      await pg.close();
      await ctx.close();
    }
  }

  // ── Interaction test: Log form at 390px (only with credentials, not in CI) ───
  if (!CI_MODE && hasCredentials) {
    process.stdout.write("\n── Interaction test: Log form (iPhone 390) ──\n");
    const ctx390 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
    });
    const logPage = await ctx390.newPage();
    await logPage.addInitScript(() => {
      try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
    });

    try {
      await signIn(logPage);
      await logPage.goto(`${BASE_URL}/aftercare`, { waitUntil: "networkidle", timeout: 20_000 });
      await logPage.waitForTimeout(800);

      // Pre-cleanup: archive any leftover device-check test treatments from prior runs (API, not UI).
      {
        const preCount = await archiveDeviceCheckTreatments();
        if (preCount > 0) {
          process.stdout.write(`  ✓ Log form: pre-cleanup archived ${preCount} orphaned test treatment(s)\n`);
          await logPage.reload({ waitUntil: "networkidle" });
          await logPage.waitForTimeout(500);
        }
      }

      // Click "+ Log a treatment"
      const logBtn = logPage.locator("button", { hasText: /Log a treatment/i }).first();
      await logBtn.waitFor({ state: "visible", timeout: 5_000 });
      await logBtn.click();
      await logPage.waitForTimeout(400);

      // Switch to Walk-in tab
      const walkinTab = logPage.locator("button", { hasText: /Walk.in/i }).first();
      await walkinTab.waitFor({ state: "visible", timeout: 3_000 });
      await walkinTab.click();
      await logPage.waitForTimeout(200);

      // Fill name only — NO email, so clientEmail=null in the API and aftercare_send_at
      // will never be set (API gate: `if (clientEmail && sendAftercare)` → false).
      await logPage.fill('input[placeholder="Client name"]', "Device Check Test");

      // Add a note marking this row as a test so it's identifiable in the DB.
      const notesArea = logPage.locator('textarea[placeholder*="e.g."]').first();
      if (await notesArea.count() > 0) {
        await notesArea.fill("device-check test");
      }

      // Select first available procedure (Botox/Lip Filler/etc.)
      const procBtns = logPage.locator("button").filter({ hasText: /botox|filler|micro|nose|skin|tear/i });
      await procBtns.first().waitFor({ state: "visible", timeout: 5_000 });
      await procBtns.first().click();
      await logPage.waitForTimeout(300);

      // Enable "Plan her return" — click the preset "6 mo" button so we don't depend on the native date picker.
      const returnPlanCheckbox = logPage.locator('input[type="checkbox"]').filter({ hasText: /Plan her return/i }).first();
      // The checkbox is inside a label — click the label text instead
      const returnPlanLabel = logPage.locator("label", { hasText: /Plan her return/i }).first();
      if (await returnPlanLabel.count() > 0) {
        await returnPlanLabel.click();
        await logPage.waitForTimeout(400);
        // Click the "6 mo" preset button — this sets the date to ~180 days out without touching the native date input
        const sixMoBtn = logPage.locator("button", { hasText: /6 mo/i }).first();
        if (await sixMoBtn.count() > 0) {
          await sixMoBtn.click();
          await logPage.waitForTimeout(200);
        }
        // Fill in the return reason
        const reasonInput = logPage.locator('input[placeholder*="Adding more volume"]').first();
        if (await reasonInput.count() > 0) {
          await reasonInput.fill("device-check test return reason");
          await logPage.waitForTimeout(200);
        }
        process.stdout.write("  ✓ Log form: Plan her return enabled with 6-month date\n");
      } else {
        process.stdout.write("  ⚠ Log form: Plan her return checkbox not found\n");
      }

      // Click submit and capture the API response to verify the plan was saved.
      const submitBtn = logPage.locator("button").filter({ hasText: /Log.*send|Log treatment/i }).first();
      await submitBtn.waitFor({ state: "visible", timeout: 3_000 });
      let savedTreatment = null;
      const [submitResp] = await Promise.all([
        logPage.waitForResponse(r => r.url().includes("/api/treatments") && r.request().method() === "POST", { timeout: 10_000 }),
        submitBtn.click(),
      ]);
      try { savedTreatment = (await submitResp.json())?.treatment ?? null; } catch { /* fall through */ }
      await logPage.waitForTimeout(1000);

      const newTreatmentId = savedTreatment?.id ?? null;

      // Verify treatment appeared
      const flashOrRow = await logPage.locator("text=/Treatment logged|Device Check Test/i").count();
      if (flashOrRow > 0) {
        process.stdout.write("  ✓ Log form: treatment saved successfully\n");
      } else {
        process.stdout.write("  ⚠ Log form: could not confirm treatment was saved (no flash or row found)\n");
      }

      // ── Verify Plan her return was actually stored ─────────────────────────
      if (savedTreatment) {
        const planOk = savedTreatment.planned_return_at && savedTreatment.reminder_lead_days != null && savedTreatment.return_reason;
        if (planOk) {
          process.stdout.write(`  ✓ Log form: plan fields saved — planned_return_at=${savedTreatment.planned_return_at}, reminder_lead_days=${savedTreatment.reminder_lead_days}, return_reason=${savedTreatment.return_reason}\n`);
        } else {
          process.stdout.write(`  ✗ Log form: FAIL — plan fields missing from saved treatment (planned_return_at=${savedTreatment.planned_return_at}, reminder_lead_days=${savedTreatment.reminder_lead_days}, return_reason=${savedTreatment.return_reason})\n`);
          totalIssues++;
        }
      } else {
        process.stdout.write("  ⚠ Log form: could not read API response to verify plan fields\n");
      }

      // ── Safety assertion: no aftercare scheduled (no email on walk-in) ─────
      const scheduledBadge = await logPage.locator("text=/Aftercare scheduled|Sending in/i").count();
      if (scheduledBadge > 0) {
        process.stdout.write("  ✗ Log form: SAFETY FAIL — aftercare was scheduled unexpectedly\n");
        totalIssues++;
      } else {
        process.stdout.write("  ✓ Log form: confirmed no aftercare email scheduled (no email → no send)\n");
      }

      // ── Cleanup: archive only the test treatment we just created (API, not UI) ──
      await logPage.waitForTimeout(300);
      if (newTreatmentId) {
        const archived = await archiveDeviceCheckTreatments(newTreatmentId);
        if (archived > 0) {
          process.stdout.write("  ✓ Log form: test treatment archived (cleanup done)\n");
        } else {
          process.stdout.write("  ⚠ Log form: archive of test treatment may have failed — check manually\n");
        }
      } else {
        // Fallback: sweep by notes
        const swept = await archiveDeviceCheckTreatments();
        process.stdout.write(`  ✓ Log form: cleanup sweep archived ${swept} test treatment(s)\n`);
      }
    } catch (e) {
      process.stdout.write(`  ⚠ Log form interaction test failed: ${e.message}\n`);
    }

    await logPage.close();
    await ctx390.close();
  }

  // ── Healing chat: test at all 6 viewports after interaction test has created a treatment ──
  // The Log form interaction test above creates and archives a treatment. We fetch the
  // archived treatment ID here (Node.js side, no page.evaluate) so /healing/[id] can be
  // tested as a logged-out screen at all 6 viewports.
  if (!CI_MODE && hasCredentials) {
    process.stdout.write("\n── Healing chat screens ──\n");
    const healingTreatmentId = await fetchTestTreatmentId();
    if (healingTreatmentId) {
      process.stdout.write(`  ✓ Healing chat: testing at /healing/${healingTreatmentId}\n`);
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          userAgent: vp.width < 768
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            : undefined,
          isMobile: vp.width < 768,
        });
        const pg = await ctx.newPage();
        await pg.addInitScript(() => {
          try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
        });
        totalScreens++;
        try {
          await pg.goto(`${BASE_URL}/healing/${healingTreatmentId}`, { waitUntil: "networkidle", timeout: 20_000 });
          await pg.waitForTimeout(500);
          const issues = await runChecks(pg, vp);
          const label = `${vp.label} [returning] — Healing Chat`;
          if (issues.length > 0) {
            process.stdout.write(`\n❌ ${label} (${BASE_URL}/healing/${healingTreatmentId})\n`);
            for (const iss of issues) {
              process.stdout.write(`   • ${iss}\n`);
              totalIssues++;
            }
          } else {
            process.stdout.write(`  ✓ ${label}\n`);
          }
        } catch (e) {
          process.stdout.write(`  ⚠ ${vp.label} [returning] — Healing Chat: ${e.message}\n`);
        }
        await pg.close();
        await ctx.close();
      }
    } else {
      process.stderr.write("  ⚠ Healing chat: no treatment found (active or archived) — skipping\n");
    }
  }
} finally {
  await browser.close();
}

if (!CI_MODE && !hasCredentials) {
  process.stderr.write(`\n⚠ Logged-in screens were skipped. Set TEST_NURSE_EMAIL and TEST_NURSE_PASSWORD in .env.local to include them.\n`);
}

process.stdout.write(`\n${totalScreens} screen×viewport combinations checked. ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found.\n`);
if (totalIssues > 0) process.exit(1);
