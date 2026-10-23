"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SideNavRail } from "@/components/SideNavRail";

interface AccountData {
  nurse_name: string;
  login_email: string;
  practice_name: string;
  location: string;
  business_hours: string;
  phone_public: string;
  alert_email: string;
  alert_email_verified: boolean;
  pending_alert_email: string | null;
  alert_phone: string;
  bot_name: string;
  greeting: string;
  slug: string;
  plan: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  frozen: boolean;
}

function SaveButton({ saving, saved, label = "Save changes" }: { saving: boolean; saved: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      style={{ touchAction: "manipulation" }}
      className="min-h-[44px] rounded-full bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50 active:scale-[0.97]"
    >
      {saving ? "Saving…" : saved ? "Saved ✅" : label}
    </button>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <h2 className="mb-4 text-base font-bold text-[#1a2744]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0d9488] focus:bg-white transition";
const TEXTAREA = `${INPUT} resize-none`;

function AccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // ── Per-section field state ──────────────────────────────────────────────
  const [nurseName, setNurseName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [location, setLocation] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [phonePublic, setPhonePublic] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [botName, setBotName] = useState("");
  const [greeting, setGreeting] = useState("");

  // ── Per-section save state ────────────────────────────────────────────────
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [practiceSaving, setPracticeSaving] = useState(false);
  const [practiceSaved, setPracticeSaved] = useState(false);
  const [alertPhoneSaving, setAlertPhoneSaving] = useState(false);
  const [alertPhoneSaved, setAlertPhoneSaved] = useState(false);
  const [alertEmailSaving, setAlertEmailSaving] = useState(false);
  const [alertEmailPending, setAlertEmailPending] = useState(false);
  const [assistantSaving, setAssistantSaving] = useState(false);
  const [assistantSaved, setAssistantSaved] = useState(false);
  const [greetingGenerating, setGreetingGenerating] = useState(false);

  // ── Auth / plan state ────────────────────────────────────────────────────
  const [portalBusy, setPortalBusy] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // ── Password / email change ───────────────────────────────────────────────
  const [pwResetSent, setPwResetSent] = useState(false);
  const [emailChangeSent, setEmailChangeSent] = useState(false);
  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [showEmailChange, setShowEmailChange] = useState(false);

  const [copied, setCopied] = useState(false);
  const [verifiedBanner, setVerifiedBanner] = useState(false);

  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function flashSaved(setter: (v: boolean) => void) {
    setter(true);
    const id = setTimeout(() => setter(false), 3000);
    savedTimers.current[String(id)] = id;
  }

  useEffect(() => {
    if (searchParams?.get("verified") === "1") setVerifiedBanner(true);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const tok = sessionData.session?.access_token;
      if (!tok) { router.replace("/auth"); return; }
      if (!cancelled) setToken(tok);
      const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${tok}` } });
      if (!res.ok) { if (!cancelled) setLoading(false); return; }
      const d = await res.json() as AccountData;
      if (!cancelled) {
        setData(d);
        setNurseName(d.nurse_name);
        setPracticeName(d.practice_name);
        setLocation(d.location);
        setBusinessHours(d.business_hours);
        setPhonePublic(d.phone_public);
        setAlertEmail(d.alert_email);
        setAlertPhone(d.alert_phone);
        setBotName(d.bot_name);
        setGreeting(d.greeting);
        if (d.pending_alert_email) setAlertEmailPending(true);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    if (!token) return { ok: false };
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ ok?: boolean; error?: string; verification_sent?: boolean }>;
  }, [token]);

  const saveProfile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const r = await post({ section: "profile", nurse_name: nurseName });
    setProfileSaving(false);
    if (r.ok) flashSaved(setProfileSaved);
    else alert(r.error ?? "Save failed");
  }, [post, nurseName]);

  const savePractice = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPracticeSaving(true);
    const r = await post({ section: "practice", practice_name: practiceName, location, business_hours: businessHours, phone_public: phonePublic });
    setPracticeSaving(false);
    if (r.ok) flashSaved(setPracticeSaved);
    else alert(r.error ?? "Save failed");
  }, [post, practiceName, location, businessHours, phonePublic]);

  const saveAlertPhone = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertPhoneSaving(true);
    const r = await post({ section: "alerts_phone", alert_phone: alertPhone });
    setAlertPhoneSaving(false);
    if (r.ok) flashSaved(setAlertPhoneSaved);
    else alert(r.error ?? "Save failed");
  }, [post, alertPhone]);

  const sendAlertEmailVerification = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertEmailSaving(true);
    const r = await post({ section: "alerts_email", alert_email: alertEmail });
    setAlertEmailSaving(false);
    if (r.verification_sent) {
      setAlertEmailPending(true);
      setData(prev => prev ? { ...prev, pending_alert_email: alertEmail } : prev);
    } else alert(r.error ?? "Save failed");
  }, [post, alertEmail]);

  const saveAssistant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAssistantSaving(true);
    const r = await post({ section: "assistant", bot_name: botName, greeting });
    setAssistantSaving(false);
    if (r.ok) flashSaved(setAssistantSaved);
    else alert(r.error ?? "Save failed");
  }, [post, botName, greeting]);

  const generateGreeting = useCallback(async () => {
    if (!token) return;
    setGreetingGenerating(true);
    try {
      const res = await fetch("/api/generate-greeting", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ practice_name: practiceName, bot_name: botName, nurse_name: nurseName }),
      });
      const j = await res.json() as { greeting?: string };
      if (j.greeting) setGreeting(j.greeting);
    } catch { /* ignore */ }
    setGreetingGenerating(false);
  }, [token, practiceName, botName, nurseName]);

  const handlePasswordReset = useCallback(async () => {
    if (!data?.login_email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(data.login_email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (!error) setPwResetSent(true);
    else alert("Could not send reset email. Please try again.");
  }, [data?.login_email]);

  const handleLoginEmailChange = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoginEmail.trim()) return;
    const { error } = await supabase.auth.updateUser({ email: newLoginEmail.trim() });
    if (!error) { setEmailChangeSent(true); setShowEmailChange(false); }
    else alert(error.message ?? "Could not update email. Please try again.");
  }, [newLoginEmail]);

  const handleFreezeToggle = useCallback(async () => {
    if (!data) return;
    const nextFrozen = !data.frozen;
    if (nextFrozen && !window.confirm("Freeze your account? Your assistant will be paused and clients will see an 'unavailable' message until you unfreeze.")) return;
    setFreezeLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const tok = sessionData.session?.access_token;
    if (!tok) { setFreezeLoading(false); return; }
    const res = await fetch("/api/my-plan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ frozen: nextFrozen }) });
    if (res.ok) setData(prev => prev ? { ...prev, frozen: nextFrozen } : prev);
    setFreezeLoading(false);
  }, [data]);

  const handleManagePlan = useCallback(async () => {
    setPortalBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const tok = sessionData.session?.access_token;
    if (!tok) { setPortalBusy(false); return; }
    try {
      const res = await fetch("/api/billing-portal", { method: "POST", headers: { Authorization: `Bearer ${tok}` } });
      const j = await res.json() as { url?: string; error?: string };
      if (res.ok && j.url) window.location.href = j.url;
      else alert(j.error ?? "Could not open billing portal. Please try again.");
    } catch { alert("Something went wrong. Please try again."); }
    setPortalBusy(false);
  }, []);

  const handleCancelMembership = useCallback(async () => {
    setCancelBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const tok = sessionData.session?.access_token;
    if (!tok) { setCancelBusy(false); return; }
    try {
      const res = await fetch("/api/billing-portal", { method: "POST", headers: { Authorization: `Bearer ${tok}` } });
      const j = await res.json() as { url?: string; error?: string };
      if (res.ok && j.url) window.location.href = j.url;
      else if (res.status === 404) alert("We couldn't find a billing account. Please email hi@adonisblue.io and we'll cancel it for you right away.");
      else alert(j.error ?? "Could not open billing portal.");
    } catch { alert("Something went wrong. Please try again."); }
    setCancelBusy(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    setDeleteBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const tok = sessionData.session?.access_token;
    if (!tok) { setDeleteBusy(false); return; }
    await fetch("/api/delete-account", { method: "POST", headers: { Authorization: `Bearer ${tok}` } });
    await supabase.auth.signOut();
    router.replace("/");
  }, [router]);

  const chatUrl = data?.slug ? `https://adonisblue.io/chat/${data.slug}` : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const plan = (data?.plan ?? "trial").toLowerCase();
  const trialEndsAt = data?.trial_ends_at ? new Date(data.trial_ends_at) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const expired = plan === "trial" && trialEndsAt !== null && trialEndsAt.getTime() < Date.now();
  const isPaid = plan === "starter" || plan === "pro";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNavRail />

      <main className="flex-1 sm:ml-20 pb-32 sm:pb-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <h1 className="text-base font-bold text-[#1a2744]">⚙️ My Account</h1>
        </div>

        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 sm:px-6">

          {/* Verified banner */}
          {verifiedBanner && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 px-5 py-3 text-sm font-semibold text-teal-800">
              ✅ Your emergency alert email is confirmed.
            </div>
          )}

          {/* ── 1. Profile ──────────────────────────────────────────────── */}
          <Section id="profile" title="👤 Profile">
            <form onSubmit={saveProfile} className="space-y-4">
              <Field label="Your name">
                <input
                  value={nurseName}
                  onChange={e => setNurseName(e.target.value)}
                  placeholder="Maria Garcia"
                  maxLength={100}
                  className={INPUT}
                />
              </Field>
              <Field label="Login email">
                <div className="flex items-center gap-2">
                  <input value={data?.login_email ?? ""} readOnly className={`${INPUT} flex-1 text-slate-400`} />
                  <button
                    type="button"
                    onClick={() => setShowEmailChange(v => !v)}
                    className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Change
                  </button>
                </div>
                {emailChangeSent && (
                  <p className="mt-1.5 text-xs font-semibold text-teal-700">
                    ✅ Check your new inbox and click the confirmation link to switch your login email.
                  </p>
                )}
                {showEmailChange && !emailChangeSent && (
                  <form onSubmit={handleLoginEmailChange} className="mt-2 flex gap-2">
                    <input
                      type="email"
                      value={newLoginEmail}
                      onChange={e => setNewLoginEmail(e.target.value)}
                      placeholder="New email address"
                      required
                      className={`${INPUT} flex-1`}
                    />
                    <button type="submit" className="shrink-0 rounded-full bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700">
                      Send link
                    </button>
                  </form>
                )}
              </Field>
              <Field label="Password">
                {pwResetSent ? (
                  <p className="text-sm font-semibold text-teal-700">✅ Password reset link sent — check your inbox.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Send password reset email
                  </button>
                )}
              </Field>
              <div className="pt-1">
                <SaveButton saving={profileSaving} saved={profileSaved} />
              </div>
            </form>
          </Section>

          {/* ── 2. My Practice ──────────────────────────────────────────── */}
          <Section id="practice" title="🏥 My Practice">
            <form onSubmit={savePractice} className="space-y-4">
              <Field label="Practice name">
                <input value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="Beauty Bar by Maria" maxLength={120} className={INPUT} />
              </Field>
              <Field label="Address" hint="Leave blank if you'd rather not share it publicly.">
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="123 Main St, Chicago, IL" maxLength={200} className={INPUT} />
              </Field>
              <Field label="Business hours" hint="Shown to clients in your chat bot.">
                <input value={businessHours} onChange={e => setBusinessHours(e.target.value)} placeholder="Mon–Fri 9am–6pm, Sat 10am–3pm" maxLength={300} className={INPUT} />
              </Field>
              <Field label="Phone clients can call" hint="This is the number shown in aftercare instructions as [YOUR PHONE].">
                <input value={phonePublic} onChange={e => setPhonePublic(e.target.value)} placeholder="+1 (555) 000-0000" maxLength={20} className={INPUT} />
              </Field>
              <div className="pt-1">
                <SaveButton saving={practiceSaving} saved={practiceSaved} />
              </div>
            </form>
          </Section>

          {/* ── 3. Emergency alerts ─────────────────────────────────────── */}
          <Section id="alerts" title="🚨 Emergency alerts">
            <p className="mb-4 text-sm text-slate-500">
              When a client types an emergency keyword, you get an email and SMS here — not to your login email.
            </p>

            {/* Alert email */}
            <form onSubmit={sendAlertEmailVerification} className="mb-5 space-y-3">
              <Field label="Alert email">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={e => { setAlertEmail(e.target.value); setAlertEmailPending(false); }}
                    placeholder="you@example.com"
                    maxLength={254}
                    className={`${INPUT} flex-1`}
                  />
                  {data?.alert_email_verified && !alertEmailPending && alertEmail === data.alert_email && (
                    <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 border border-teal-200">✅ Verified</span>
                  )}
                  {data?.alert_email && !data.alert_email_verified && alertEmail === data.alert_email && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 border border-amber-200">⚠️ Not verified</span>
                  )}
                </div>
              </Field>
              {alertEmailPending ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  <p className="font-semibold">Check your inbox at {data?.pending_alert_email ?? alertEmail}</p>
                  <p className="mt-0.5 text-xs text-teal-600">Click "Yes, this is me" to confirm. Until then, alerts still go to your previous verified address.</p>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={alertEmailSaving || !alertEmail}
                  style={{ touchAction: "manipulation" }}
                  className="min-h-[44px] rounded-full border-2 border-[#0d9488] bg-white px-5 py-2 text-sm font-semibold text-[#0d9488] transition hover:bg-teal-50 disabled:opacity-50"
                >
                  {alertEmailSaving ? "Sending…" : "Send verification email"}
                </button>
              )}
            </form>

            {/* Alert phone */}
            <form onSubmit={saveAlertPhone} className="space-y-3">
              <Field label="Alert phone (SMS)" hint="For SMS alerts when a client is in distress. Optional.">
                <input
                  value={alertPhone}
                  onChange={e => setAlertPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  maxLength={20}
                  className={INPUT}
                />
              </Field>
              <SaveButton saving={alertPhoneSaving} saved={alertPhoneSaved} label="Save phone" />
            </form>
          </Section>

          {/* ── 4. My Assistant ─────────────────────────────────────────── */}
          <Section id="assistant" title="🦋 My Assistant">
            <form onSubmit={saveAssistant} className="space-y-4">
              <Field label="Assistant name" hint="What clients see as the chat bot's name.">
                <input value={botName} onChange={e => setBotName(e.target.value)} placeholder="Beauty Bar Assistant" maxLength={100} className={INPUT} />
              </Field>
              <Field label="Welcome message">
                <textarea
                  value={greeting}
                  onChange={e => setGreeting(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Hi! I'm the Beauty Bar Assistant…"
                  className={TEXTAREA}
                />
                <button
                  type="button"
                  onClick={generateGreeting}
                  disabled={greetingGenerating}
                  className="mt-1.5 text-xs font-semibold text-[#0d9488] hover:underline disabled:opacity-50"
                >
                  {greetingGenerating ? "Generating…" : "✨ Generate one for me"}
                </button>
              </Field>
              <Field label="Chat link">
                <div className="flex items-center gap-2">
                  <input value={chatUrl} readOnly className={`${INPUT} flex-1 text-slate-400 text-xs`} />
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard.writeText(chatUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">This link is permanent — it will never change.</p>
              </Field>
              <div className="pt-1">
                <SaveButton saving={assistantSaving} saved={assistantSaved} />
              </div>
            </form>
          </Section>

          {/* ── 5. Plan ─────────────────────────────────────────────────── */}
          <Section id="plan" title="💳 Plan">
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${isPaid ? "text-teal-600 bg-teal-50 border-teal-200" : expired ? "text-red-600 bg-red-50 border-red-200" : "text-amber-600 bg-amber-50 border-amber-200"}`}>
                {isPaid ? "Starter" : "Free beta"}
              </span>
              {!isPaid && !expired && daysLeft !== null && (
                <span className="text-sm text-slate-500">· <span className="font-semibold text-amber-600">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span> left</span>
              )}
              {expired && <span className="text-sm font-semibold text-red-500">· Trial expired</span>}
            </div>
            {expired && <p className="mt-2 text-sm text-red-500">Your trial has ended. Upgrade to keep your bot running.</p>}
            <div className="mt-3">
              {isPaid ? (
                <button
                  type="button"
                  disabled={portalBusy}
                  onClick={() => void handleManagePlan()}
                  className="rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {portalBusy ? "Opening…" : "Manage billing →"}
                </button>
              ) : (
                <Link href="/upgrade" className="inline-flex rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700">
                  Upgrade to Starter →
                </Link>
              )}
            </div>
          </Section>

          {/* ── 6. Account options ──────────────────────────────────────── */}
          <Section id="options" title="Account options">
            <div className="space-y-3">
              {/* Freeze */}
              <div>
                <button
                  type="button"
                  disabled={freezeLoading}
                  onClick={() => void handleFreezeToggle()}
                  className={`min-h-[44px] w-full rounded-full border-2 px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${data?.frozen ? "border-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100" : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  {freezeLoading ? "Saving…" : data?.frozen ? "❄️ Unfreeze my account" : "❄️ Freeze my account"}
                </button>
                <p className={`mt-1 px-1 text-xs font-semibold ${data?.frozen ? "text-amber-600" : "text-slate-400"}`}>
                  {data?.frozen ? "Your assistant is paused. Clients cannot chat until you unfreeze." : "Temporarily pauses your assistant — clients will see an 'unavailable' message."}
                </p>
              </div>

              {/* Cancel membership */}
              {isPaid && (
                <div className="border-t border-slate-100 pt-3">
                  {cancelDone ? (
                    <p className="rounded-full border-2 border-teal-300 bg-teal-50 px-4 py-2 text-center text-sm font-semibold text-teal-700">
                      ✓ Membership canceled — you keep access until the end of your billing period.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={cancelBusy}
                      onClick={() => void handleCancelMembership()}
                      className="min-h-[44px] w-full rounded-full border-2 border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {cancelBusy ? "Opening billing portal…" : "Cancel membership"}
                    </button>
                  )}
                </div>
              )}

              {/* Delete account */}
              <div className="border-t border-slate-100 pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-sm font-medium text-red-600 underline decoration-red-600/40 underline-offset-2 transition hover:text-red-700"
                >
                  Delete account
                </button>
              </div>
            </div>
          </Section>

        </div>
      </main>

      {/* ── Delete dialog ──────────────────────────────────────────────────── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-[#1a2744]">Delete your account?</h2>
            <p className="mb-4 text-sm text-slate-500">This permanently deletes your account, bot, client data, and treatments. This cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleConfirmDelete()}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Yes, delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageInner />
    </Suspense>
  );
}
