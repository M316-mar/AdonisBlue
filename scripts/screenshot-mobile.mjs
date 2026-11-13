/**
 * Takes full-page WebKit screenshots of all logged-in screens at 375px and 390px.
 * Saves to /tmp/screenshots/
 * Usage: node scripts/screenshot-mobile.mjs
 */
import { webkit } from "playwright";
import { mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dir, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const eq = l.indexOf("="); return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]; })
);

const BASE = "http://localhost:3000";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const SCREENS = [
  { path: "/dashboard", label: "home" },
  { path: "/aftercare", label: "log" },
  { path: "/client-journey", label: "emails" },
  { path: "/offers", label: "offers" },
  { path: "/account", label: "account" },
  { path: "/dashboard", label: "alerts" },
];
const WIDTHS = [375, 390];
const OUT = "/tmp/screenshots";
mkdirSync(OUT, { recursive: true });

async function signIn(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 20000 });
  const loginTab = page.locator("button", { hasText: /log in/i }).first();
  if (await loginTab.isVisible()) await loginTab.click();
  await page.fill('input[type="email"]', env.TEST_NURSE_EMAIL);
  await page.fill('input[type="password"]', env.TEST_NURSE_PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(url => !url.pathname.startsWith("/auth"), { timeout: 10000 });
  } catch { /* might already be redirected */ }
  await page.waitForTimeout(1500);
}

const browser = await webkit.launch({ headless: true });
let total = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    userAgent: IPHONE_UA,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem("adonisblue_cookie_consent", "true"); } catch {}
    try { localStorage.setItem("adonisblue-welcome-seen", "true"); } catch {}
    // Clear draft treatment forms
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("adonisblue_treatment_draft")) localStorage.removeItem(k);
    }
  });

  try {
    await signIn(page);
    for (const screen of SCREENS) {
      await page.goto(`${BASE}${screen.path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1500);
      const path = `${OUT}/${width}-${screen.label}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log(`✓ ${width}px ${screen.label} → ${path}`);
      total++;
    }
  } catch (e) {
    console.error(`✗ ${width}px failed: ${e.message}`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${total} screenshots saved to ${OUT}/`);
