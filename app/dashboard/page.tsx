"use client";

import { signOutCompletely, supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";


type BotRow = {
  slug?: string | null;
  practice_name?: string | null;
  bot_name?: string | null;
  services?: string[] | null;
  booking_link?: string | null;
  photos?: string[] | null;
  cancellation_policy?: string | null;
  aftercare?: string | null;
  launched?: boolean | null;
  frozen?: boolean | null;
  plan?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
};

type IntakeRow = {
  id: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  service_interested: string | null;
  referred_by: string | null;
  created_at: string;
  survey_sent?: boolean | null;
  aftercare_sent_at?: string | null;
  reminder_6m_sent?: boolean | null;
  reminder_9m_sent?: boolean | null;
};

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "my-practice";
}


function displayNameFromUser(user: { user_metadata?: { full_name?: string }; email?: string } | null): string {
  if (!user) return "there";
  const fromMeta = user.user_metadata?.full_name;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const email = user.email;
  if (email) return email.split("@")[0] ?? "there";
  return "there";
}

export default function NurseDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurseName, setNurseName] = useState("there");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [bot, setBot] = useState<BotRow | null>(null);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [surveyLoading, setSurveyLoading] = useState<string | null>(null);
  const [aftercareLoading, setAftercareLoading] = useState<string | null>(null);
  const [intakesOpen, setIntakesOpen] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [showLaunchCelebration, setShowLaunchCelebration] = useState(false);
  const [justLaunched, setJustLaunched] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [showEmailNotice, setShowEmailNotice] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);
  const [hasOffer, setHasOffer] = useState(false);
  const [showAccountManagement, setShowAccountManagement] = useState(false);

  useEffect(() => {
    setShowEmailNotice(!localStorage.getItem("emailNoticesDismissed"));
    if (!localStorage.getItem("adonisblue-welcome-seen")) {
      setShowWelcome(true);
    }
    setEmbedCopied(localStorage.getItem("ab-embed-copied") === "1");
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#embed") {
      setEmbedOpen(true);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    localStorage.setItem("adonisblue-welcome-seen", "true");
    setShowWelcome(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      setNurseName(displayNameFromUser(data.session.user));

      const token = data.session.access_token;
      if (token) {
        const res = await fetch("/api/mybot", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const json = await res.json();
          const row = json?.bot ?? json;
          setBot(row && typeof row === "object" && !Array.isArray(row) ? row as BotRow : null);
          const alreadyCelebrated = localStorage.getItem("ab-celebrated-" + (row?.slug || ""));
          if (row?.launched && !alreadyCelebrated) {
            setShowLaunchCelebration(true);
            setJustLaunched(true);
          }

          // Fetch recent intakes
          const intakesRes = await fetch("/api/myintakes", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && intakesRes.ok) {
            const intakesJson = await intakesRes.json();
            setIntakes(intakesJson.intakes ?? []);
          }

          // Fetch booking connect status
          const bookingRes = await fetch("/api/booking-connect", {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!cancelled && bookingRes.ok) {
            const bookingJson = await bookingRes.json() as { has_secret?: boolean };
            setHasBooking(Boolean(bookingJson.has_secret));
          }

          // Fetch offers count
          const offersRes = await fetch("/api/offers", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && offersRes.ok) {
            const offersJson = await offersRes.json() as { offers?: unknown[] };
            setHasOffer(Array.isArray(offersJson.offers) && offersJson.offers.length > 0);
          }
        }
      }

      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Load Tawk.to live support chat — dashboard only
  useEffect(() => {
    const s1 = document.createElement("script");
    s1.async = true;
    s1.src = "https://embed.tawk.to/6a57c832096ab21d402a63f3/1jtjec19d";
    s1.charset = "UTF-8";
    s1.setAttribute("crossorigin", "*");
    s1.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tawk = (window as any).Tawk_API;
      if (tawk) {
        tawk.onLoad = function () {};
      }
    };
    document.head.appendChild(s1);
    return () => {
      try { document.head.removeChild(s1); } catch {}
    };
  }, []);

  const launched = bot?.launched === true;
  const botChatSlug = useMemo(() => {
    if (bot?.slug) return bot.slug;
    const raw = (bot?.bot_name || "").trim() || (bot?.practice_name || "").trim() || "my-bot";
    return slugify(raw);
  }, [bot?.slug, bot?.bot_name, bot?.practice_name]);

  const totalClients = useMemo(() => intakes.length, [intakes]);
  const aftercareSent = useMemo(() => intakes.filter((i) => i.aftercare_sent_at).length, [intakes]);

  const pendingFollowUpCount = useMemo(
    () => intakes.filter((i) => !i.aftercare_sent_at || !i.survey_sent).length,
    [intakes]
  );
  const reviewsRequested = useMemo(() => intakes.filter((i) => i.survey_sent).length, [intakes]);
  const remindersScheduled = useMemo(
    () => intakes.filter((i) => i.aftercare_sent_at && !i.reminder_6m_sent).length,
    [intakes]
  );

  const handleLogout = useCallback(async () => {
    await signOutCompletely();
    router.push("/auth");
  }, [router]);

  const handleManagePlan = useCallback(async () => {
    setPortalBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setPortalBusy(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch("/api/billing-portal", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const j = await res.json() as { url?: string; error?: string };
        if (res.ok && j.url) {
          window.location.href = j.url;
        } else {
          alert(j.error ?? "Could not open billing portal. Please try again.");
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          alert("This is taking longer than expected. Please check your connection and try again.");
        } else {
          alert("Something went wrong opening the billing portal. Please try again.");
        }
      }
    } finally {
      setPortalBusy(false);
    }
  }, []);

  const handleCancelMembership = useCallback(async () => {
    if (!window.confirm("Are you sure you want to cancel your membership? You'll keep access until the end of your billing period.")) return;
    setCancelBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCancelDone(true);
      } else {
        alert("Something went wrong. Please try again or contact support.");
      }
    } finally {
      setCancelBusy(false);
    }
  }, []);

  const handleConfirmDeleteDialog = useCallback(async () => {
    setDeleteBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/delete-account", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await signOutCompletely();
      router.push("/");
    } finally {
      setDeleteBusy(false);
    }
  }, [router]);

  const handleSendSurvey = useCallback(async (intake: IntakeRow) => {
    setSurveyLoading(intake.id);
    await fetch("/api/send-survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake_id: intake.id }),
    });
    setIntakes((prev) => prev.map((i) => i.id === intake.id ? { ...i, survey_sent: true } : i));
    setSurveyLoading(null);
  }, []);

  const handleSendAftercare = useCallback(async (intake: IntakeRow) => {
    setAftercareLoading(intake.id);
    await fetch("/api/send-aftercare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake_id: intake.id }),
    });
    setIntakes((prev) => prev.map((i) => i.id === intake.id ? { ...i, aftercare_sent_at: new Date().toISOString() } : i));
    setAftercareLoading(null);
  }, []);

  const handleFreezeToggle = useCallback(async () => {
    if (!bot) return;
    const nextFrozen = !bot.frozen;
    if (nextFrozen && !window.confirm("Freeze your account? Your assistant will be paused and clients will see an 'unavailable' message until you unfreeze.")) return;
    setFreezeLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/my-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ frozen: nextFrozen }),
        });
        setBot(prev => prev ? { ...prev, frozen: nextFrozen } : prev);
      }
    } finally {
      setFreezeLoading(false);
    }
  }, [bot]);

  const handleDeleteIntake = useCallback(async (id: string) => {
    await fetch("/api/delete-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setIntakes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#1a2744]/80">Loading your dashboard…</p>
      </div>
    );
  }

  const nurseFirstName = (() => {
    const trimmed = nurseName.trim();
    if (!trimmed || trimmed === "there") return "there";
    const first = trimmed.split(/\s+/)[0] ?? trimmed;
    return first.charAt(0).toUpperCase() + first.slice(1);
  })();

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Image src="/Alona.png" alt="AdonisBlue" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12" />
            <span className="truncate text-base font-semibold tracking-tight text-[#1a2744] sm:text-lg">AdonisBlue</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-[#1a2744] sm:inline sm:max-w-xs md:text-base">
              {nurseName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
        <p className="mx-auto max-w-6xl truncate px-4 pb-2 text-xs font-medium text-teal-100/90 sm:hidden">{nurseName}</p>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-28 lg:px-8 lg:py-10 lg:pb-28">
        {showEmailNotice && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start justify-between gap-3">
            <p className="text-xs text-amber-800">📬 <strong>Heads up:</strong> The first email from AdonisBlue may land in your client&apos;s spam folder. Ask them to mark it as &quot;Not Spam&quot; so future emails go straight to their inbox!</p>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => {
                localStorage.setItem("emailNoticesDismissed", "true");
                setShowEmailNotice(false);
              }}
              className="shrink-0 text-amber-400 hover:text-amber-600 text-xs"
            >
              ✕
            </button>
          </div>
        )}
        <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 flex items-center gap-3">
          <span className="text-lg shrink-0">💉</span>
          <p className="text-sm text-teal-800 flex-1">After every appointment, log your treatment in Treatment Records so AdonisBlue can send aftercare emails and rebooking reminders automatically.</p>
          <a href="/aftercare" className="shrink-0 text-sm font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap">Log a treatment →</a>
        </div>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
          <div className="space-y-6 lg:col-span-8">
            <section className="relative overflow-hidden rounded-2xl border border-teal-900/20 bg-gradient-to-br from-[#1a2744] to-[#0d3d38] px-4 py-6 shadow-lg sm:px-6 sm:py-8">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_85%_0%,rgba(13,148,136,0.22),transparent),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(56,189,248,0.12),transparent)] opacity-90"
                aria-hidden
              />
              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-wider text-teal-300/90">Your dashboard</p>
                <h1 className="mt-2 text-balance text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-[1.65rem]">
                  Welcome back, {nurseFirstName}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {pendingFollowUpCount > 0
                    ? `${pendingFollowUpCount} client${pendingFollowUpCount !== 1 ? "s" : ""} due for follow-up today.`
                    : "Nothing needs you right now. Your assistant is live and watching."}
                </p>
              </div>
            </section>

            {/* ── Assistant setup status ── */}
            {!launched ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <p className="text-sm font-semibold text-[#1a2744]">Let&apos;s get your assistant set up</p>
                <p className="mt-1 text-sm text-slate-500">Your AI front desk is a few steps away.</p>
                <Link
                  href="/onboarding?step=1"
                  className="mt-3 inline-flex items-center rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Set up my assistant →
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4 shadow-sm">
                <p className="text-sm text-[#1a2744]">You&apos;re all set! Your assistant is live and your practice is fully set up. Share your link and start getting clients.</p>
              </div>
            )}

            {(() => {
              const pendingIntakes = intakes.filter((i) => !i.aftercare_sent_at || !i.survey_sent);
              return pendingIntakes.length > 0 ? (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-md">
                  <button
                    type="button"
                    onClick={() => setIntakesOpen((o) => !o)}
                    className="flex w-full items-center justify-between px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-sm">💌</span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-[#1a2744]">Client Intakes & Follow-ups</p>
                        <p className="text-xs text-slate-400">{pendingIntakes.length} client{pendingIntakes.length !== 1 ? "s" : ""} need follow-up</p>
                      </div>
                    </div>
                    <span className="text-slate-400 text-sm">{intakesOpen ? "▲" : "▼"}</span>
                  </button>
                  {intakesOpen ? (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-6">
                      <p className="mb-3 text-xs leading-relaxed text-slate-600">Know how you did, collect real reviews, and use them on your Google Business, website, or social media. Every review builds your reputation 💙</p>
                      <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
                        <span className="text-base">💡</span>
                        <p className="text-xs leading-relaxed text-amber-800">
                          <strong>Heads up:</strong> The first email from AdonisBlue may land in your client's spam folder. Ask them to mark it as "Not Spam" so future emails go straight to their inbox!
                        </p>
                      </div>
                      <ul className="space-y-3">
                        {pendingIntakes.map((intake) => (
                          <li key={intake.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[#1a2744]">{intake.first_name || "Client"}</p>
                              <p className="text-xs text-slate-500">{intake.service_interested || "Service not specified"} • {new Date(intake.created_at).toLocaleDateString()}</p>
                              {intake.referred_by ? <p className="text-xs text-teal-600">Found you via {intake.referred_by}</p> : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!!intake.aftercare_sent_at}
                                onClick={() => router.push("/client-journey")}
                                className="shrink-0 rounded-full bg-[#1a2744] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#243552] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {intake.aftercare_sent_at ? "Aftercare sent ✅" : "Send aftercare 💌"}
                              </button>
                              <button
                                type="button"
                                disabled={!!intake.survey_sent || surveyLoading === intake.id}
                                onClick={() => void handleSendSurvey(intake)}
                                className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {intake.survey_sent ? "Review requested ✅" : surveyLoading === intake.id ? "Sending..." : "Request review ⭐"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteIntake(intake.id)}
                                className="shrink-0 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null;
            })()}


            {launched ? (
              <>
                {/* ── The Blue Room (main content) — de-emphasized, secondary to core actions ── */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1a2744]">The Blue Room</p>
                    <p className="text-xs text-slate-500">Your private community of nurse injectors.</p>
                  </div>
                  <Link
                    href="/blueroom"
                    className="shrink-0 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                  >
                    Enter →
                  </Link>
                </div>

                {/* ── Add to your website (collapsible, main content) ── */}
                <section id="embed" className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEmbedOpen(o => !o)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-sm">💻</span>
                      <p className="text-sm font-semibold text-[#1a2744]">Add to your website</p>
                    </div>
                    <span className="text-slate-400 text-sm">{embedOpen ? "▲" : "▾"}</span>
                  </button>
                  {embedOpen && (
                    <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                      <p className="text-xs leading-relaxed text-slate-500">Copy this code and paste it before the closing <code className="rounded bg-slate-100 px-1 text-[#1a2744]">&lt;/body&gt;</code> tag on your website. Your bot will appear automatically — updates apply instantly, no changes needed on your site.</p>
                      <div className="mt-3 rounded-xl bg-[#1a2744] px-3 py-3">
                        <code className="block break-all text-xs leading-relaxed text-teal-200">
                          {`<script async src="https://adonisblue.io/embed.js" data-bot-slug="${botChatSlug}"></script>`}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => { void navigator.clipboard.writeText(`<script async src="https://adonisblue.io/embed.js" data-bot-slug="${botChatSlug}"></script>`); localStorage.setItem("ab-embed-copied", "1"); setEmbedCopied(true); }}
                        className="mt-3 w-full rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                      >
                        Copy embed code
                      </button>
                    </div>
                  )}
                </section>
              </>
            ) : null}

            {/* ── Instagram Automation, Stats, My Plan ── */}
            <div className="max-w-2xl space-y-4">
              {/* ── Instagram Automation ── */}
              <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📱</span>
                  <h3 className="text-sm font-bold text-[#1a2744]">Instagram Automation</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 mb-3">
                  Let clients comment a keyword on your posts and automatically receive your bot link in a DM — hands free.
                </p>
                <Link
                  href="/instagram-automation"
                  className="inline-flex w-full items-center justify-center rounded-full border border-pink-200 bg-white px-4 py-2 text-xs font-bold text-pink-600 transition hover:bg-pink-50"
                >
                  Set up Instagram automation →
                </Link>
              </div>

              {/* ── Stats ── */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total Clients", value: totalClients, emoji: "💌" },
                  { label: "Aftercare Sent", value: aftercareSent, emoji: "✅" },
                  { label: "Reviews Requested", value: reviewsRequested, emoji: "⭐" },
                  { label: "Auto Reminders", value: remindersScheduled, emoji: "🔔" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-60"
                      style={{ background: "radial-gradient(ellipse 80% 60% at 80% 0%, rgba(13,148,136,0.25), transparent)" }}
                      aria-hidden
                    />
                    <div className="relative">
                      <p className="text-xl font-bold tabular-nums text-[#1a2744]">{stat.value}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{stat.emoji} {stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── My Plan ── */}
              {(() => {
                const plan = (bot?.plan ?? "trial").toLowerCase();
                const trialEndsAt = bot?.trial_ends_at
                  ? new Date(bot.trial_ends_at)
                  : null;
                const daysLeft = trialEndsAt
                  ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null;
                const expired = plan === "trial" && trialEndsAt !== null && trialEndsAt.getTime() < Date.now();
                const planLabel = plan === "starter" || plan === "pro" ? "💳 Starter" : "🆓 Trial";
                const planColor = plan === "starter" || plan === "pro"
                  ? "text-teal-600 bg-teal-50 border-teal-200"
                  : expired
                  ? "text-red-600 bg-red-50 border-red-200"
                  : "text-amber-600 bg-amber-50 border-amber-200";
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                    <h3 className="text-sm font-semibold text-[#1a2744]">My Plan</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${planColor}`}>{planLabel}</span>
                      {expired && <span className="text-xs font-semibold text-red-500">Trial expired</span>}
                    </div>
                    {plan === "trial" && !expired && daysLeft !== null && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        <span className="font-semibold text-amber-600">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span> left in your free trial
                      </p>
                    )}
                    {expired && (
                      <p className="mt-1.5 text-xs text-red-500">Your trial has ended. Upgrade to keep your bot running.</p>
                    )}
                    {plan === "trial" || plan === "free" ? (
                      <Link
                        href="/upgrade"
                        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2 text-center text-xs font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                      >
                        Upgrade to Starter →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={portalBusy}
                        onClick={() => void handleManagePlan()}
                        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2 text-center text-xs font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700 disabled:opacity-60"
                      >
                        {portalBusy ? "Opening portal…" : "Manage plan →"}
                      </button>
                    )}
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAccountManagement((v) => !v)}
                        className="mb-1.5 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
                      >
                        {showAccountManagement ? "Hide account options ▲" : "Manage account ▾"}
                      </button>
                    </div>
                    {showAccountManagement && (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          disabled={freezeLoading}
                          onClick={() => void handleFreezeToggle()}
                          className={`inline-flex w-full items-center justify-center rounded-full border-2 px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            bot?.frozen
                              ? "border-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100"
                              : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {freezeLoading ? "Saving…" : bot?.frozen ? "❄️ Unfreeze my account" : "❄️ Freeze my account"}
                        </button>
                        <p className={`text-xs px-1 font-semibold ${bot?.frozen ? "text-amber-600" : "text-slate-400"}`}>
                          {bot?.frozen
                            ? "Your assistant is paused. Clients cannot chat until you unfreeze."
                            : "Temporarily pauses your assistant — clients will see an 'unavailable' message instead of the chat."}
                        </p>
                        {(plan === "starter" || plan === "pro") && (
                          cancelDone ? (
                            <p className="text-center text-xs font-semibold text-teal-700 rounded-full border-2 border-teal-300 bg-teal-50 px-4 py-1.5">
                              ✓ Membership canceled — you keep access until the end of your billing period.
                            </p>
                          ) : (
                            <div className="border-t border-slate-100 pt-1.5">
                              <button
                                type="button"
                                onClick={() => void handleCancelMembership()}
                                disabled={cancelBusy}
                                className="inline-flex w-full items-center justify-center rounded-full border-2 border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                {cancelBusy ? "Canceling…" : "Cancel membership"}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5">
                <h3 className="text-base font-semibold text-[#1a2744] sm:text-lg">Your Practice</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-slate-500">Practice name</dt>
                    <dd className="mt-0.5 font-medium text-[#1a2744]">{bot?.practice_name?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Booking link</dt>
                    <dd className="mt-0.5 flex items-center gap-2">
                      <span className="min-w-0 truncate font-medium text-[#0d9488]" title={bot?.booking_link?.trim() || undefined}>
                        {(() => {
                          const link = bot?.booking_link?.trim() || "";
                          if (!link) return "—";
                          return link.length > 30 ? `${link.slice(0, 27)}…` : link;
                        })()}
                      </span>
                      {bot?.booking_link?.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(bot.booking_link!.trim());
                            setBookingCopied(true);
                            setTimeout(() => setBookingCopied(false), 2000);
                          }}
                          className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 transition hover:bg-teal-50 hover:text-teal-600"
                        >
                          {bookingCopied ? "Copied!" : "Copy"}
                        </button>
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href="/onboarding?step=1"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                  >
                    Edit my assistant
                  </Link>
                  {launched ? (
                    <Link
                      href={`/chat/${botChatSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#1a2744] transition hover:bg-slate-50"
                    >
                      Preview my assistant
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3 flex flex-col gap-2">
                  <Link
                    href="/aftercare"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                  >
                    Log a treatment
                  </Link>
                  <Link
                    href="/insights"
                    className="inline-flex w-full items-center justify-center text-center text-sm font-medium text-slate-500 transition hover:text-[#0d9488]"
                  >
                    View my insights
                  </Link>
                  <Link
                    href="/client-journey"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                  >
                    Send Emails &amp; Alerts
                  </Link>
                  <Link
                    href="/offers"
                    className="inline-flex w-full items-center justify-center text-center text-sm font-medium text-slate-500 transition hover:text-[#0d9488]"
                  >
                    Offers & Specials
                  </Link>
                  <Link
                    href="/booking-connect"
                    className="inline-flex w-full items-center justify-center text-center text-sm font-medium text-slate-500 transition hover:text-[#0d9488]"
                  >
                    Connect Booking Software
                  </Link>
                  {process.env.NEXT_PUBLIC_SHOW_LOYALTY === "true" && (
                    <Link
                      href="/loyalty"
                      className="inline-flex w-full items-center justify-center text-center text-sm font-medium text-slate-500 transition hover:text-[#0d9488]"
                    >
                      Referrals & Loyalty
                    </Link>
                  )}
                </div>
              </div>

            </div>
          </aside>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 lg:mt-10 lg:pt-8">
          <p className="text-xs text-slate-500">
            Want to delete your account?{" "}
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-xs font-medium text-red-600 underline decoration-red-600/40 underline-offset-2 transition hover:text-red-700"
            >
              Delete account
            </button>
          </p>
        </div>

        {showWelcome && !showLaunchCelebration ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
            <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={dismissWelcome} />
            <div className="relative z-[101] w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h2 id="welcome-modal-title" className="text-lg font-bold text-[#1a2744]">Welcome to AdonisBlue! 🦋</h2>
              <p className="mt-1 text-sm text-slate-500">Here&apos;s all you need to know:</p>
              <ul className="mt-4 space-y-3">
                {[
                  { icon: "🔗", text: "Your assistant link — Share it on Instagram or your website. Clients can chat 24/7." },
                  { icon: "🩹", text: "Aftercare — Log a treatment after each appointment. The right email goes out automatically." },
                  { icon: "🚨", text: "Emergency alerts — If a client types a concerning symptom, you get an immediate email." },
                  { icon: "📊", text: "Insights — See how many clients your assistant captured." },
                  { icon: "❄️", text: "Freeze — Going on vacation? Freeze your assistant so clients see a pause message." },
                ].map(({ icon, text }) => (
                  <li key={icon} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 shrink-0">{icon}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={dismissWelcome}
                className="mt-6 w-full rounded-full bg-[#0d9488] py-3 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Got it! Let&apos;s go 🦋
              </button>
            </div>
          </div>
        ) : null}

        {deleteDialogOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close dialog"
              onClick={() => !deleteBusy && setDeleteDialogOpen(false)}
            />
            <div className="relative z-[101] w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
              <h2 id="delete-account-title" className="sr-only">
                Delete account
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">
                Are you sure? Deleting your account removes everything permanently — your bot, settings, and photos. This cannot be undone.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteDialogOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={handleConfirmDeleteDialog}
                  className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteBusy ? "Signing out…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {showLaunchCelebration ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowLaunchCelebration(false);
              localStorage.setItem("ab-celebrated-" + botChatSlug, "true");
            }}
          />
          <div className="relative z-[201] w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[#1a2744] via-[#0d4f6b] to-[#0d9488] p-6 shadow-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(56,189,248,0.2),transparent)]" aria-hidden />
            <div className="relative text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Your bot is live!</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Congratulations! Your AI front desk is ready to answer clients 24/7. Share it everywhere!
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal-300">Your bot link</p>
                  <p className="break-all text-sm font-medium text-white">https://adonisblue.io/chat/{botChatSlug}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(`https://adonisblue.io/chat/${botChatSlug}`);
                  }}
                  className="w-full rounded-full bg-white px-6 py-3 text-sm font-bold text-[#1a2744] shadow-lg transition hover:bg-teal-50"
                >
                  📋 Copy my bot link
                </button>

                <a
                  href={`https://www.instagram.com/?url=https://adonisblue.io/chat/${botChatSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-full border-2 border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/20"
                >
                  📱 Share on Instagram
                </a>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(`<script async src="https://adonisblue.io/embed.js" data-bot-slug="${botChatSlug}"></script>`);
                  }}
                  className="block w-full rounded-full border-2 border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/20"
                >
                  💻 Copy embed code
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowLaunchCelebration(false);
                  localStorage.setItem("ab-celebrated-" + botChatSlug, "true");
                }}
                className="mt-4 text-xs text-slate-400 underline underline-offset-2 transition hover:text-white"
              >
                Close and go to dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Feedback button (bottom-left) ── */}
      <div className="fixed bottom-6 left-6 z-[9999] flex flex-col items-start gap-2">
        {feedbackOpen && (
          <div className="w-[min(100vw-3rem,20rem)] rounded-2xl border border-slate-200/80 bg-white p-4 shadow-lg shadow-slate-900/10">
            <p className="text-sm font-semibold text-[#1a2744]">💡 Share an idea</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Have a feature idea or suggestion? We&apos;d love to hear it!
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488]/40 focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20"
              placeholder="What feature would make AdonisBlue even better for you?"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const res = await fetch("/api/send-feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ feedback: feedbackText.trim(), nurse_name: nurseName }),
                    });
                    if (res.ok) { setFeedbackText(""); setFeedbackOpen(false); }
                  })();
                }}
                className="flex-1 rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
              >
                Submit
              </button>
              <button type="button" onClick={() => setFeedbackOpen(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setFeedbackOpen(o => !o)}
          className="rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700"
        >
          {feedbackOpen ? "✕ Close" : "💡 Share an idea"}
        </button>
      </div>

    </div>
  );
}
