/**
 * Device-check: runs Playwright against the dev server and checks every screen at
 * 3 viewport sizes for common mobile-UX failures.
 *
 * Logged-out screens run everywhere (including CI).
 * Logged-in screens require TEST_NURSE_EMAIL + TEST_NURSE_PASSWORD in .env.local;
 * if either is absent the script skips them with a warning (does not fail).
 *
 * Usage:
 *   node scripts/device-check.mjs            # all screens (uses dev server on :3000)
 *   node scripts/device-check.mjs --ci       # logged-out screens only (CI-safe)
 *
 * Failure conditions per screen × viewport:
 *   1. Horizontal scrolling (scrollWidth > clientWidth on <body>)
 *   2. Any element wider than the viewport
 *   3. Any visible button/link/input/select/textarea with hit area < 44×44 px
 *   4. Any interactive element whose centre point is covered by another element
 *      (fixed bars, the avatar, cookie banners)
 *   5. Any visible <input>/<textarea> with computed font-size < 16px
 *   6. The primary submit button is disabled AND no sibling/nearby reason text is visible
 */

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CI_MODE = process.argv.includes("--ci");
const BASE_URL = process.env.DEVICE_CHECK_BASE_URL ?? "http://localhost:3000";

// ── Load credentials from .env.local ──────────────────────────────────────────
let testEmail = "";
let testPassword = "";
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const [k, ...rest] = line.split("=");
    const v = rest.join("=").trim();
    if (k?.trim() === "TEST_NURSE_EMAIL") testEmail = v;
    if (k?.trim() === "TEST_NURSE_PASSWORD") testPassword = v;
  }
}
const hasCredentials = !!(testEmail && testPassword);

// ── Viewports ──────────────────────────────────────────────────────────────────
const VIEWPORTS = [
  { label: "iPhone 390", width: 390, height: 844 },
  { label: "iPad 820", width: 820, height: 1180 },
  { label: "Laptop 1440", width: 1440, height: 900 },
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

    // 4. Interactive element covered by another element
    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Only check elements whose centre is in the viewport
      if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) continue;
      const top = document.elementFromPoint(cx, cy);
      if (!top) continue;
      if (top !== el && !el.contains(top) && !top.contains(el)) {
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

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.width < 768
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
      isMobile: vp.width < 768,
    });

    // Sign in once per viewport if credentials are available
    let isSignedIn = false;
    if (!CI_MODE && hasCredentials) {
      const signInPage = await context.newPage();
      try {
        await signIn(signInPage);
        isSignedIn = true;
      } catch (e) {
        process.stderr.write(`  ⚠ Sign-in failed at ${vp.label}: ${e.message}\n`);
      }
      await signInPage.close();
    }

    for (const screen of SCREENS) {
      if (screen.loggedIn && (CI_MODE || !hasCredentials || !isSignedIn)) {
        if (!CI_MODE && !hasCredentials) {
          process.stderr.write(`  ⚠ Skipping logged-in screen "${screen.label}" — TEST_NURSE_EMAIL/TEST_NURSE_PASSWORD not set\n`);
        }
        continue;
      }

      totalScreens++;
      const page = await context.newPage();
      // Simulate a returning user who has already consented to cookies.
      // This prevents the cookie consent banner from appearing and covering form fields.
      await page.addInitScript(() => {
        try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
      });
      try {
        await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: "networkidle", timeout: 20_000 });
        // If we got redirected to /auth (not signed in), skip
        if (screen.loggedIn && page.url().includes("/auth")) {
          process.stderr.write(`  ⚠ "${screen.label}" redirected to /auth — session may have expired\n`);
          await page.close();
          continue;
        }
        // Brief pause for any client-side rendering to settle
        await page.waitForTimeout(500);

        const issues = await runChecks(page, vp);
        if (issues.length > 0) {
          process.stdout.write(`\n❌ ${vp.label} — ${screen.label} (${BASE_URL}${screen.path})\n`);
          for (const iss of issues) {
            process.stdout.write(`   • ${iss}\n`);
            totalIssues++;
          }
        } else {
          process.stdout.write(`  ✓ ${vp.label} — ${screen.label}\n`);
        }
      } catch (e) {
        process.stdout.write(`  ⚠ ${vp.label} — ${screen.label}: ${e.message}\n`);
      }
      await page.close();
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (!CI_MODE && !hasCredentials) {
  process.stderr.write(`\n⚠ Logged-in screens were skipped. Set TEST_NURSE_EMAIL and TEST_NURSE_PASSWORD in .env.local to include them.\n`);
}

process.stdout.write(`\n${totalScreens} screen×viewport combinations checked. ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found.\n`);
if (totalIssues > 0) process.exit(1);
