"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformInstruction {
  title: string;
  steps: string[];
}

interface Instructions {
  vagaro: PlatformInstruction;
  jane: PlatformInstruction;
  square: PlatformInstruction;
  acuity: PlatformInstruction;
  mindbody: PlatformInstruction;
  generic: PlatformInstruction;
}

interface ConnectData {
  webhook_url: string | null;
  has_secret: boolean;
  instructions: Instructions;
}

type PlatformKey = keyof Instructions;

interface SoftwareOption {
  key: PlatformKey;
  name: string;
  emoji: string;
  tagline: string;
  price: string;
  badge: string;
  badgeColor: string; // Tailwind classes
  url: string;
}

interface Platform {
  key: PlatformKey;
  name: string;
  emoji: string;
  source: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = [
  { key: "vagaro", name: "Vagaro", emoji: "💆", source: "vagaro" },
  { key: "jane", name: "Jane App", emoji: "🏥", source: "jane" },
  { key: "square", name: "Square", emoji: "⬛", source: "square" },
  { key: "acuity", name: "Acuity", emoji: "📅", source: "acuity" },
  { key: "mindbody", name: "Mindbody", emoji: "🧘", source: "mindbody" },
  { key: "generic", name: "Generic / Other", emoji: "🔗", source: "generic" },
];

const SOFTWARE_OPTIONS: SoftwareOption[] = [
  {
    key: "square",
    name: "Square Appointments",
    emoji: "⬛",
    tagline: "Best for beginners — free plan available, easy setup, and no contracts.",
    price: "Free plan · paid from $29/mo",
    badge: "Best for beginners",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    url: "https://squareup.com/us/en/appointments",
  },
  {
    key: "acuity",
    name: "Acuity Scheduling",
    emoji: "📅",
    tagline: "Best for customization — highly flexible intake forms and scheduling rules.",
    price: "From $16/mo",
    badge: "Most customizable",
    badgeColor: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    url: "https://acuityscheduling.com",
  },
  {
    key: "vagaro",
    name: "Vagaro",
    emoji: "💆",
    tagline: "Best for solo injectors — built-in marketing tools, memberships, and POS.",
    price: "From $30/mo",
    badge: "Most popular",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    url: "https://vagaro.com",
  },
  {
    key: "jane",
    name: "Jane App",
    emoji: "🏥",
    tagline: "Best for medical & clinical settings — HIPAA compliant with robust charting.",
    price: "From $79/mo",
    badge: "HIPAA compliant",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    url: "https://jane.app",
  },
  {
    key: "mindbody",
    name: "Mindbody",
    emoji: "🧘",
    tagline: "Best for larger practices — enterprise features, large marketplace exposure.",
    price: "From $129/mo",
    badge: "For larger practices",
    badgeColor: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    url: "https://mindbodyonline.com",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingConnectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connectData, setConnectData] = useState<ConnectData | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<PlatformKey | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/api/booking-connect", {
        headers: { authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json() as ConnectData;
        setConnectData(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token ?? null;
      if (!accessToken) {
        router.replace("/auth");
        return;
      }
      setToken(accessToken);
      void fetchData(accessToken);
    }).catch(() => {
      router.replace("/auth");
    });
  }, [router, fetchData]);

  function handleCopy() {
    if (!connectData?.webhook_url) return;
    // Append a placeholder source when copying
    navigator.clipboard.writeText(connectData.webhook_url + "YOUR_PLATFORM").catch(() => {});
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }

  function platformWebhookUrl(source: string): string {
    if (!connectData?.webhook_url) return "";
    return connectData.webhook_url + source;
  }

  async function handleTest() {
    if (!connectData?.webhook_url) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const testUrl = connectData.webhook_url + "test";
      const res = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Test Client",
          client_email: "test@example.com",
          service: "Lip Filler",
          date: new Date().toISOString().split("T")[0],
          source: "test",
        }),
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: "✅ Connection successful! Your webhook is working." });
      } else {
        setTestResult({ ok: false, msg: `❌ Webhook returned status ${res.status}. Check your setup.` });
      }
    } catch {
      setTestResult({ ok: false, msg: "❌ Could not reach your webhook. Make sure the URL is correct." });
    } finally {
      setTestLoading(false);
    }
  }

  async function handleGenerate(action: "generate" | "regenerate") {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/booking-connect", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchData(token);
      }
    } catch {
      // silently fail
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1628]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1628]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-teal-500/30 bg-[#1a2744] px-4 py-3 [padding-top:max(12px,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Back to dashboard"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold text-white">🔗 Connect Booking Software</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 [padding-bottom:max(24px,env(safe-area-inset-bottom))]">
        {/* Privacy banner */}
        <div className="rounded-2xl border border-teal-500/30 bg-teal-900/20 px-4 py-3.5 flex gap-3 items-start">
          <span className="text-base shrink-0 mt-0.5">🔒</span>
          <p className="text-xs leading-relaxed text-slate-300">
            <span className="font-semibold text-teal-300">Your clients&apos; payment data is always safe</span>{" "}
            — AdonisBlue never receives, stores, or processes credit card or payment information. Only appointment details (name, service, date) are shared with AdonisBlue. Deposits and payments stay entirely within your booking software.
          </p>
        </div>

        {/* Webhook URL card */}
        <div className="rounded-2xl border border-slate-700 bg-[#1a2744] p-5 shadow-lg">
          <h2 className="mb-3 text-base font-bold text-white">Your webhook URL</h2>

          {connectData?.has_secret ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={platformWebhookUrl("YOUR_PLATFORM")}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-600 bg-[#0d1628] px-3 py-2 font-mono text-base text-teal-300 focus:outline-none"
                  style={{ touchAction: "manipulation" }}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="min-h-[44px] rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 active:scale-95"
                  style={{ touchAction: "manipulation" }}
                >
                  {copied ? "Copied! ✓" : "Copy URL"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Replace <code className="rounded bg-slate-700 px-1 text-teal-300">YOUR_PLATFORM</code> with the platform name (e.g.{" "}
                <code className="rounded bg-slate-700 px-1 text-teal-300">vagaro</code>).
              </p>
              <div className="mt-4 border-t border-slate-700 pt-4 flex flex-col gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => void handleTest()}
                    disabled={testLoading}
                    className="min-h-[40px] rounded-full border border-teal-500 px-5 py-2 text-sm font-semibold text-teal-300 transition hover:bg-teal-900/40 disabled:opacity-50 active:scale-95"
                    style={{ touchAction: "manipulation" }}
                  >
                    {testLoading ? "Testing…" : "Test connection →"}
                  </button>
                  <p className="mt-1.5 text-xs text-slate-500">Sends sample data to verify your webhook is working.</p>
                  {testResult && (
                    <div className="mt-2">
                      <p className={`text-xs font-medium ${testResult.ok ? "text-teal-400" : "text-rose-400"}`}>
                        {testResult.msg}
                      </p>
                      {!testResult.ok && (
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                          If you haven&apos;t connected your booking software yet, this is expected. Come back and test after pasting your webhook URL into Vagaro, Jane, or your booking platform.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => void handleGenerate("regenerate")}
                    disabled={actionLoading}
                    className="text-xs font-medium text-rose-400 underline underline-offset-2 transition hover:text-rose-300 disabled:opacity-50"
                    style={{ touchAction: "manipulation" }}
                  >
                    {actionLoading ? "Regenerating…" : "Regenerate URL"}
                  </button>
                  <span className="ml-2 text-xs text-slate-500">— This will break existing connections</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-sm text-slate-400">
                Generate a secure webhook URL to connect your booking software.
              </p>
              <button
                type="button"
                onClick={() => void handleGenerate("generate")}
                disabled={actionLoading}
                className="min-h-[44px] rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-teal-700 disabled:opacity-50 active:scale-95"
                style={{ touchAction: "manipulation" }}
              >
                {actionLoading ? "Generating…" : "Generate webhook URL"}
              </button>
            </div>
          )}
        </div>

        {/* Platform cards */}
        <div id="platform-cards">
          <h2 className="mb-3 text-base font-bold text-white">Connect your platform</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PLATFORMS.map((platform) => {
              const isExpanded = expandedPlatform === platform.key;
              const instructions = connectData?.instructions[platform.key];
              return (
                <div key={platform.key} className="col-span-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPlatform(isExpanded ? null : platform.key)
                    }
                    className={`min-h-[44px] w-full rounded-2xl border px-4 py-3 text-left transition active:scale-95 ${
                      isExpanded
                        ? "border-teal-500 bg-teal-900/30 text-white"
                        : "border-slate-700 bg-[#1a2744] text-slate-300 hover:border-teal-600 hover:text-white"
                    }`}
                    style={{ touchAction: "manipulation" }}
                  >
                    <span className="text-xl">{platform.emoji}</span>
                    <p className="mt-1 text-sm font-semibold">{platform.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <code>?source={platform.source}</code>
                    </p>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Expanded instructions */}
          {expandedPlatform && connectData?.instructions[expandedPlatform] && (() => {
            const platform = PLATFORMS.find((p) => p.key === expandedPlatform)!;
            const instr = connectData.instructions[expandedPlatform];
            const platformUrl = platformWebhookUrl(platform.source);
            return (
              <div className="mt-4 rounded-2xl border border-teal-500/30 bg-[#1a2744] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{platform.emoji}</span>
                  <h3 className="text-base font-bold text-white">{instr.title}</h3>
                </div>

                {connectData.has_secret && (
                  <div className="mb-4 rounded-xl bg-[#0d1628] p-3">
                    <p className="mb-1 text-xs text-slate-400">Your {platform.name} webhook URL:</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 break-all text-xs text-teal-300">{platformUrl}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(platformUrl).catch(() => {});
                        }}
                        className="min-h-[36px] rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600"
                        style={{ touchAction: "manipulation" }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <ol className="space-y-2">
                  {instr.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-300">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-900 text-xs font-bold text-teal-300">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })()}
        </div>
        {/* ── Which booking software is right for me? ───────────────────── */}
        <div>
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">
              Which booking software is right for me? 🤔
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Don&rsquo;t have booking software yet? Here&rsquo;s a quick comparison to help you choose.
            </p>
          </div>

          <div className="space-y-3">
            {SOFTWARE_OPTIONS.map((opt) => (
              <div
                key={opt.key}
                className="rounded-2xl border border-slate-700 bg-[#1a2744] p-5 transition hover:border-slate-600"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{opt.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{opt.name}</h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${opt.badgeColor}`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-teal-400">{opt.price}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{opt.tagline}</p>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={opt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center rounded-full border border-slate-600 bg-transparent px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white active:scale-95"
                    style={{ touchAction: "manipulation" }}
                  >
                    Learn more ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedPlatform(opt.key);
                      // Scroll the platform cards section into view
                      document
                        .getElementById("platform-cards")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="inline-flex min-h-[40px] items-center rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 active:scale-95"
                    style={{ touchAction: "manipulation" }}
                  >
                    I use this one — set it up →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-5 py-4 text-center">
            <p className="text-sm text-slate-300 leading-relaxed">
              AdonisBlue works with all of these — pick what feels right for you.{" "}
              <span className="font-semibold text-white">We&rsquo;ll help you get set up! 💙</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
