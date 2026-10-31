"use client";

import { signOutCompletely, supabase } from "@/lib/supabase";
import { formatTreatmentDate } from "@/lib/formatTreatmentDate";
import { localDateString } from "@/lib/localDate";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SideNavRail } from "@/components/SideNavRail";
import { AssistantPanel } from "@/components/AssistantPanel";


type BotRow = {
  slug?: string | null;
  practice_name?: string | null;
  bot_name?: string | null;
  services?: string[] | null;
  booking_link?: string | null;
  rebooking_link?: string | null;
  photos?: string[] | null;
  cancellation_policy?: string | null;
  aftercare?: string | null;
  launched?: boolean | null;
  frozen?: boolean | null;
  plan?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
  google_review_link?: string | null;
  facebook_review_link?: string | null;
  ready_at?: string | null;
  alert_email_verified?: boolean | null;
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
  review_submitted_at?: string | null;
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
  const [intakesOpen, setIntakesOpen] = useState(false);

  const [alertCount, setAlertCount] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [showLaunchCelebration, setShowLaunchCelebration] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [showEmailNotice, setShowEmailNotice] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [hasOffer, setHasOffer] = useState(false);
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [noShowDialog, setNoShowDialog] = useState<{ id: string; name: string } | null>(null);

  type ReviewSummary = {
    total: number;
    averageRating: number | null;
    okToShareCount: number;
    needsAttentionCount: number;
    newestReview: { rating: number; review_text: string | null; ok_to_share: boolean } | null;
  };
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);

  type ReturnClient = {
    treatment_id: string;
    intake_id: string;
    client_name: string;
    procedure_name: string;
    due_date: string;
    reminder_send_date: string;
    rebooked_at: string | null;
    rebooked_source: string | null;
    opted_out: boolean;
  };
  const [returnClients, setReturnClients] = useState<ReturnClient[]>([]);
  const [returnBookingBusy, setReturnBookingBusy] = useState<string | null>(null);

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
      if (!cancelled) setSessionToken(token || null);
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
          }

          // Fetch recent intakes
          const intakesRes = await fetch("/api/myintakes", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && intakesRes.ok) {
            const intakesJson = await intakesRes.json();
            setIntakes(intakesJson.intakes ?? []);
          }

          // Fetch offers count
          const offersRes = await fetch("/api/offers", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && offersRes.ok) {
            const offersJson = await offersRes.json() as { offers?: unknown[] };
            setHasOffer(Array.isArray(offersJson.offers) && offersJson.offers.length > 0);
          }

          // Fetch reviews summary
          const reviewsRes = await fetch("/api/reviews", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && reviewsRes.ok) {
            const reviewsJson = await reviewsRes.json() as {
              reviews?: Array<{ rating: number; review_text: string | null; ok_to_share: boolean; removed_at: string | null; reached_out_at: string | null; created_at: string }>
            };
            const all = (reviewsJson.reviews ?? []).filter((r) => !r.removed_at);
            if (all.length > 0) {
              const total = all.length;
              const avgRating = all.reduce((s, r) => s + r.rating, 0) / total;
              const okToShareCount = all.filter((r) => r.ok_to_share).length;
              const needsAttentionCount = all.filter((r) => r.rating <= 3 && !r.reached_out_at).length;
              const newest = all[0];
              setReviewSummary({
                total,
                averageRating: Math.round(avgRating * 10) / 10,
                okToShareCount,
                needsAttentionCount,
                newestReview: { rating: newest.rating, review_text: newest.review_text, ok_to_share: newest.ok_to_share },
              });
            } else {
              setReviewSummary({ total: 0, averageRating: null, okToShareCount: 0, needsAttentionCount: 0, newestReview: null });
            }
          }

          // Fetch return clients
          const returnRes = await fetch("/api/return-clients", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && returnRes.ok) {
            const returnJson = await returnRes.json() as { clients?: ReturnClient[] };
            setReturnClients(returnJson.clients ?? []);
          }
        }
      }

      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);


  const launched = bot?.ready_at != null || bot?.launched === true;
  const needsAlertVerify = launched && bot?.alert_email_verified === false;
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

  const handleReturnBooking = useCallback(async (treatmentId: string, action: "booked" | "unbook") => {
    setReturnBookingBusy(treatmentId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/return-clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ treatment_id: treatmentId, action }),
      });
      if (res.ok) {
        setReturnClients((prev) =>
          prev.map((c) =>
            c.treatment_id === treatmentId
              ? { ...c, rebooked_at: action === "booked" ? new Date().toISOString() : null, rebooked_source: action === "booked" ? "nurse" : null }
              : c
          )
        );
      }
    } finally {
      setReturnBookingBusy(null);
    }
  }, []);

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
    // Route to the Stripe Billing Portal — it handles cancel-at-period-end correctly
    // and shows the nurse exactly when access ends. No direct cancel API needed.
    setCancelBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
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
        } else if (res.status === 404) {
          alert("We couldn't find a billing account for your subscription. Please email hi@adonisblue.io and we'll cancel it for you right away.");
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
      localStorage.clear();
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
    <div className="flex min-h-screen">
      <SideNavRail />
      <div className="flex-1 min-w-0 sm:pl-20">
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Image src="/Alona.png" alt="AdonisBlue" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12" />
            <span className="truncate text-base font-semibold tracking-tight text-[#1a2744] sm:text-lg">AdonisBlue</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("assistant-panel");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1a2744] transition hover:bg-slate-50"
              aria-label={alertCount > 0 ? `${alertCount} unhandled alert${alertCount !== 1 ? "s" : ""}` : "Go to assistant"}
            >
              🔔
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {alertCount}
                </span>
              )}
            </button>
            <Link
              href="/account"
              className="hidden items-center gap-2 sm:flex min-w-0 max-w-[14rem]"
              aria-label="My Account"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-xs font-bold text-white transition hover:bg-[#0d9488] select-none">
                {nurseName ? nurseName.trim()[0]?.toUpperCase() : "·"}
              </span>
              <span className="truncate text-sm font-medium text-[#1a2744] hover:text-teal-700 md:text-base">
                {nurseName}
              </span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
        <Link href="/account" className="mx-auto block max-w-6xl truncate px-4 pb-2 text-xs font-medium text-teal-100/90 sm:hidden hover:text-white">{nurseName}</Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-28 lg:px-8 lg:py-10 lg:pb-28">
        <div className="grid gap-6 md:grid-cols-12 md:gap-8 md:items-start">
          <div className="space-y-6 md:col-span-8">
            {sessionToken && (
              <AssistantPanel
                nurseFirstName={nurseFirstName}
                token={sessionToken}
                bot={bot}
                returnClients={returnClients}
                onAlertCountChange={setAlertCount}
              />
            )}

            {/* ── Clients coming back — always visible, below Assistant ── */}
            <section id="return-clients" className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
              <div className="px-4 py-4 sm:px-6 border-b border-slate-100">
                <p className="text-sm font-semibold text-[#1a2744]">💙 Clients coming back</p>
                <p className="text-xs text-slate-400 mt-0.5">Clients due back in the next 30 days. Save them a spot in your calendar.</p>
              </div>
              {returnClients.length === 0 ? (
                <div className="px-4 py-5 sm:px-6">
                  <p className="text-sm text-slate-400">No clients due back in the next 30 days. They&apos;ll show up here automatically after you log treatments.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {returnClients.map((c) => {
                    const isBooked = !!c.rebooked_at;
                    const today = localDateString();
                    const isPastDue = !isBooked && c.due_date < today;
                    const reminderAlreadySent = c.reminder_send_date <= today;
                    const dueFmt = formatTreatmentDate(c.due_date, { month: "short", day: "numeric" });
                    const reminderFmt = formatTreatmentDate(c.reminder_send_date, { month: "short", day: "numeric" });

                    // Build .ics content for "Hold a spot" calendar reminder
                    const icsDate = c.due_date.replace(/-/g, "");
                    const icsContent = [
                      "BEGIN:VCALENDAR",
                      "VERSION:2.0",
                      "PRODID:-//AdonisBlue//EN",
                      "BEGIN:VEVENT",
                      `DTSTART;VALUE=DATE:${icsDate}`,
                      `DTEND;VALUE=DATE:${icsDate}`,
                      `SUMMARY:Keep a slot open for ${c.client_name} — ${c.procedure_name}\\, due ${dueFmt}`,
                      `DESCRIPTION:${c.client_name} is due back for ${c.procedure_name} around ${dueFmt}. Hold a slot open for them.`,
                      "BEGIN:VALARM",
                      "TRIGGER:-P7D",
                      "ACTION:DISPLAY",
                      `DESCRIPTION:${c.client_name} is due back for ${c.procedure_name} in 7 days — save them a slot!`,
                      "END:VALARM",
                      "END:VEVENT",
                      "END:VCALENDAR",
                    ].join("\r\n");
                    const icsBlob = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

                    return (
                      <li key={c.treatment_id} className={`px-4 py-3 sm:px-6 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between ${isBooked ? "bg-green-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1a2744]">
                            {isBooked ? "🟢" : "🟡"} {c.client_name} {isPastDue ? "was" : "is"} due back for {c.procedure_name}{isPastDue ? ` on ${dueFmt}` : ` on ${dueFmt}`}.
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isBooked
                              ? "Booked. Reminders stopped."
                              : c.opted_out
                              ? "She turned off reminders."
                              : reminderAlreadySent
                              ? `We reminded her on ${reminderFmt}.`
                              : `We'll remind her on ${reminderFmt}.`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!isBooked && (
                            <a
                              href={icsBlob}
                              download={`hold-slot-${c.client_name.replace(/\s+/g, "-").toLowerCase()}.ics`}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              📅 Hold a spot
                            </a>
                          )}
                          {isBooked ? (
                            <button
                              type="button"
                              disabled={returnBookingBusy === c.treatment_id}
                              onClick={() => void handleReturnBooking(c.treatment_id, "unbook")}
                              className="text-xs text-slate-400 hover:text-slate-600 underline transition disabled:opacity-50"
                            >
                              {returnBookingBusy === c.treatment_id ? "…" : "Undo"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={returnBookingBusy === c.treatment_id}
                              onClick={() => void handleReturnBooking(c.treatment_id, "booked")}
                              className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                            >
                              {returnBookingBusy === c.treatment_id ? "…" : "✅ She booked"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="relative overflow-hidden rounded-2xl border border-teal-900/20 bg-gradient-to-br from-[#1a2744] to-[#0d3d38] px-4 py-6 shadow-lg sm:px-6 sm:py-8">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_85%_0%,rgba(13,148,136,0.22),transparent),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(56,189,248,0.12),transparent)] opacity-90"
                aria-hidden
              />
              <div className="relative">
                <h1 className="text-balance text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-[1.65rem]">
                  {!bot
                    ? <>Welcome, {nurseFirstName} 👋</>
                    : bot.launched
                    ? <>Welcome back, {nurseFirstName} ✨</>
                    : <>Almost there, {nurseFirstName}! 🦋</>}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {!bot
                    ? "Let's get your AI front desk set up — it only takes 5 minutes."
                    : launched
                    ? "✅ You're all set! Your assistant is live and ready."
                    : "Your setup isn't complete yet. Finish it to go live."}
                </p>
                {!bot && (
                  <Link
                    href="/onboarding"
                    className="mt-4 inline-flex items-center rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                  >
                    Start setup →
                  </Link>
                )}
                {bot && !launched && (
                  <Link
                    href="/onboarding"
                    className="mt-4 inline-flex items-center rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                  >
                    Continue setup →
                  </Link>
                )}
              </div>
            </section>

            {needsAlertVerify && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                <p className="text-xs text-amber-800 flex-1">🔔 <strong>Verify your emergency alert email</strong> — we haven&apos;t confirmed where to send urgent client alerts yet. <Link href="/onboarding?step=5" className="underline font-semibold">Verify now →</Link></p>
              </div>
            )}

            {showEmailNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start justify-between gap-3">
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
            {returnClients.length > 0 && (
              <section id="return-clients" className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
                <div className="px-4 py-4 sm:px-6 border-b border-slate-100">
                  <p className="text-sm font-semibold text-[#1a2744]">🔁 Coming back soon</p>
                  <p className="text-xs text-slate-400 mt-0.5">Clients due back in the next 30 days. Save them a spot in your calendar.</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {returnClients.map((c) => {
                    const isBooked = !!c.rebooked_at;
                    const today = localDateString();
                    const isPastDue = !isBooked && c.due_date < today;
                    const reminderAlreadySent = c.reminder_send_date <= today;
                    const dueFmt = formatTreatmentDate(c.due_date, { month: "short", day: "numeric" });
                    const reminderFmt = formatTreatmentDate(c.reminder_send_date, { month: "short", day: "numeric" });
                    return (
                      <li key={c.treatment_id} className={`px-4 py-3 sm:px-6 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between ${isBooked ? "bg-green-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1a2744]">
                            {isBooked ? "🟢" : "🟡"} {c.client_name} {isPastDue ? "was" : "is"} due back for {c.procedure_name}{isPastDue ? ` on ${dueFmt}` : ` on ${dueFmt}`}.
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isBooked
                              ? "Booked. Reminders stopped."
                              : c.opted_out
                              ? "She turned off reminders."
                              : reminderAlreadySent
                              ? `We reminded her on ${reminderFmt}.`
                              : `We'll remind her on ${reminderFmt}.`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isBooked ? (
                            <button
                              type="button"
                              disabled={returnBookingBusy === c.treatment_id}
                              onClick={() => void handleReturnBooking(c.treatment_id, "unbook")}
                              className="text-xs text-slate-400 hover:text-slate-600 underline transition disabled:opacity-50"
                            >
                              {returnBookingBusy === c.treatment_id ? "…" : "Undo"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={returnBookingBusy === c.treatment_id}
                              onClick={() => void handleReturnBooking(c.treatment_id, "booked")}
                              className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                            >
                              {returnBookingBusy === c.treatment_id ? "…" : "✅ She booked"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 flex items-center gap-3">
              <span className="text-lg shrink-0">💉</span>
              <p className="text-sm text-teal-800 flex-1">After every appointment, log your treatment in Treatment Records so AdonisBlue can send aftercare emails and rebooking reminders automatically.</p>
              <a href="/aftercare" className="shrink-0 text-sm font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap">Log a treatment →</a>
            </div>

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
                                onClick={() => router.push(`/client-journey?aftercare=${intake.id}`)}
                                className="shrink-0 rounded-full bg-[#1a2744] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#243552] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {intake.aftercare_sent_at ? "Aftercare sent ✅" : "Send aftercare 💌"}
                              </button>
                              <button
                                type="button"
                                disabled={!!intake.review_submitted_at || !!intake.survey_sent || surveyLoading === intake.id}
                                onClick={() => void handleSendSurvey(intake)}
                                className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {intake.review_submitted_at ? "Review received ✅" : intake.survey_sent ? "Review requested ✅" : surveyLoading === intake.id ? "Sending..." : "Request review ⭐"}
                              </button>
                              {intake.review_submitted_at ? (
                                <span className="shrink-0 text-xs text-slate-400">Can&apos;t remove — this client left a review.</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setNoShowDialog({ id: intake.id, name: intake.first_name || "this client" })}
                                  className="shrink-0 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                                >
                                  No-show? Remove
                                </button>
                              )}
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
                        <div className="border-t border-slate-100 pt-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setDeleteDialogOpen(true)}
                            className="text-xs font-medium text-red-600 underline decoration-red-600/40 underline-offset-2 transition hover:text-red-700"
                          >
                            Delete account
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>

          <aside className="md:col-span-4">
            <div className="space-y-3">

              {/* ── Compact Bot Widget ── */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🤖</span>
                  <h3 className="text-sm font-semibold text-[#1a2744]">AI Bot Assistant</h3>
                  {launched ? (
                    <span className="ml-auto rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-600">LIVE</span>
                  ) : (
                    <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">DRAFT</span>
                  )}
                </div>
                <p className="mb-0.5 text-xs font-medium text-slate-500">Practice</p>
                <p className="mb-3 text-sm font-semibold text-[#1a2744]">{bot?.practice_name?.trim() || "—"}</p>
                {bot?.booking_link?.trim() && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="min-w-0 truncate text-xs font-medium text-[#0d9488]" title={bot.booking_link.trim()}>
                      {bot.booking_link.trim().length > 28 ? `${bot.booking_link.trim().slice(0, 25)}…` : bot.booking_link.trim()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(bot!.booking_link!.trim());
                        setBookingCopied(true);
                        setTimeout(() => setBookingCopied(false), 2000);
                      }}
                      className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 transition hover:bg-teal-50 hover:text-teal-600"
                    >
                      {bookingCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Link
                    href="/onboarding?step=1"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0d9488] px-4 py-2 text-center text-xs font-semibold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700"
                  >
                    Edit assistant
                  </Link>
                  {launched ? (
                    <Link
                      href={`/chat/${botChatSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                    >
                      Preview →
                    </Link>
                  ) : null}
                </div>
              </div>


            {/* ── Your Reviews Widget ── */}
            <Link href="/reviews" className="block">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg transition hover:shadow-xl">
                <div className="flex items-center gap-2 bg-[#1a2744] px-4 py-3">
                  <span className="text-base">⭐</span>
                  <span className="text-sm font-semibold text-white">Your Reviews</span>
                  {reviewSummary && reviewSummary.needsAttentionCount > 0 && (
                    <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      {reviewSummary.needsAttentionCount} need{reviewSummary.needsAttentionCount === 1 ? "s" : ""} attention
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {!reviewSummary || reviewSummary.total === 0 ? (
                    <div className="space-y-2">
                      {bot?.google_review_link ? (
                        <>
                          <p className="text-xs text-slate-500">Your review emails send clients to Google ⭐</p>
                          <a
                            href={bot.google_review_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-block text-xs font-semibold text-[#0d9488] underline decoration-dotted hover:text-teal-700"
                          >
                            Open my Google reviews ↗
                          </a>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-slate-500">Reviews from your clients will show up here.</p>
                          {!bot?.facebook_review_link && (
                            <p className="text-xs text-[#0d9488]">Add where clients can review you →</p>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-[#1a2744]">{reviewSummary.averageRating}</span>
                        <span className="text-sm text-amber-400">{"★".repeat(Math.round(reviewSummary.averageRating ?? 0))}{"☆".repeat(5 - Math.round(reviewSummary.averageRating ?? 0))}</span>
                        <span className="text-xs text-slate-400">{reviewSummary.total} review{reviewSummary.total !== 1 ? "s" : ""} · {reviewSummary.okToShareCount} shareable</span>
                      </div>
                      {reviewSummary.newestReview && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-relaxed">
                          {reviewSummary.newestReview.ok_to_share && reviewSummary.newestReview.review_text
                            ? <>&ldquo;{reviewSummary.newestReview.review_text.slice(0, 100)}{reviewSummary.newestReview.review_text.length > 100 ? "…" : ""}&rdquo;</>
                            : <span className="text-slate-400">{"★".repeat(reviewSummary.newestReview.rating)} Private review</span>
                          }
                        </div>
                      )}
                      {!bot?.google_review_link && !bot?.facebook_review_link && (
                        <p className="text-xs text-[#0d9488]">Add where clients can review you →</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>

            </div>

          </aside>
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

        {noShowDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="noshow-dialog-title">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close"
              onClick={() => setNoShowDialog(null)}
            />
            <div className="relative z-[101] w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <h2 id="noshow-dialog-title" className="text-base font-semibold text-[#1a2744]">
                Remove {noShowDialog.name}?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Use this if she never came to her appointment. She won&apos;t get aftercare, check-ins, or review emails. This can&apos;t be undone.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setNoShowDialog(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteIntake(noShowDialog.id);
                    setNoShowDialog(null);
                  }}
                  className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Yes, remove
                </button>
              </div>
            </div>
          </div>
        )}
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


    </div>
      </div>
    </div>
  );
}
