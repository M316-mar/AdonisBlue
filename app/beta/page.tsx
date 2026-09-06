"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2";
const INPUT_ERROR =
  "w-full rounded-xl border border-red-400 bg-white px-4 py-3 text-base text-[#1a2744] outline-none ring-red-400/20 transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2";
const TEXTAREA = INPUT + " resize-none";
const TEXTAREA_ERROR = INPUT_ERROR + " resize-none";
const LABEL = "mb-1.5 block text-sm font-semibold text-[#1a2744]";
const FIELD = "flex flex-col gap-1";

const providerTypes = [
  "Yes, I work on my own",
  "I work with a small team",
  "No",
];
const frequencies = [
  "Almost every day",
  "A few times a week",
  "A few times a month",
  "Rarely",
];
const timeTakerOptions = [
  "Prices or service details",
  "Booking or appointment openings",
  "Before-and-after care",
  "Rescheduling or cancellations",
  "Location, hours, or directions",
  "Treatment questions",
  "Other",
];
const feedbackOptions = [
  "Yes, I am happy to help",
  "Yes, but I prefer feedback by message",
  "Maybe, I would like to know more",
  "No",
];

type Fields = {
  full_name: string;
  business_name: string;
  email: string;
  instagram_handle: string;
  provider_type: string;
  message_frequency: string;
  recent_example: string;
  top_time_takers: string[];
  most_wanted_help: string;
  feedback_willingness: string;
  why_beta: string;
  dream_feature: string;
  agreed: boolean;
};

const empty: Fields = {
  full_name: "",
  business_name: "",
  email: "",
  instagram_handle: "",
  provider_type: "",
  message_frequency: "",
  recent_example: "",
  top_time_takers: [],
  most_wanted_help: "",
  feedback_willingness: "",
  why_beta: "",
  dream_feature: "",
  agreed: false,
};

function OptionCard({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
        selected
          ? "border-[#0d9488] bg-teal-50 font-semibold text-[#0d9488]"
          : disabled
          ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
          : "border-slate-200 bg-white text-[#1a2744] hover:border-teal-300 hover:bg-teal-50/40"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-[#0d9488] bg-[#0d9488]" : "border-slate-300"
          }`}
        >
          {selected && (
            <span className="h-2 w-2 rounded-full bg-white" />
          )}
        </span>
        {label}
      </span>
    </button>
  );
}

function CheckCard({
  label,
  checked,
  onClick,
  disabled,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !checked}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
        checked
          ? "border-[#0d9488] bg-teal-50 font-semibold text-[#0d9488]"
          : disabled
          ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
          : "border-slate-200 bg-white text-[#1a2744] hover:border-teal-300 hover:bg-teal-50/40"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            checked ? "border-[#0d9488] bg-[#0d9488]" : "border-slate-300"
          }`}
        >
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {label}
      </span>
    </button>
  );
}

export default function BetaPage() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [summaryError, setSummaryError] = useState("");
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const firstErrorRef = useRef<HTMLDivElement | null>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function toggleCheck(option: string) {
    const next = fields.top_time_takers.includes(option)
      ? fields.top_time_takers.filter((v) => v !== option)
      : fields.top_time_takers.length < 3
      ? [...fields.top_time_takers, option]
      : fields.top_time_takers;
    set("top_time_takers", next);
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Fields, string>> = {};
    if (!fields.full_name.trim()) e.full_name = "Please enter your full name.";
    if (!fields.business_name.trim()) e.business_name = "Please enter your business name.";
    if (!fields.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      e.email = "Please enter a valid email address.";
    if (!fields.provider_type) e.provider_type = "Please select an option.";
    if (!fields.message_frequency) e.message_frequency = "Please select an option.";
    if (!fields.recent_example.trim()) e.recent_example = "Please share a recent example.";
    if (fields.top_time_takers.length === 0) e.top_time_takers = "Please select at least one.";
    if (!fields.most_wanted_help.trim()) e.most_wanted_help = "Please answer this question.";
    if (!fields.feedback_willingness) e.feedback_willingness = "Please select an option.";
    if (!fields.why_beta.trim()) e.why_beta = "Please tell us why you want to join.";
    if (!fields.agreed) e.agreed = "Please check this box to continue.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSummaryError("");
    setApiError("");

    if (!validate()) {
      setSummaryError("Please answer all required questions before submitting.");
      setTimeout(() => {
        const el = document.querySelector("[data-error='true']");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/beta-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fields.full_name.trim(),
          business_name: fields.business_name.trim(),
          email: fields.email.trim(),
          instagram_handle: fields.instagram_handle.trim() || null,
          provider_type: fields.provider_type,
          message_frequency: fields.message_frequency,
          recent_example: fields.recent_example.trim(),
          top_time_takers: fields.top_time_takers,
          most_wanted_help: fields.most_wanted_help.trim(),
          feedback_willingness: fields.feedback_willingness,
          why_beta: fields.why_beta.trim(),
          dream_feature: fields.dream_feature.trim() || null,
        }),
      });

      if (res.ok) {
        router.push("/beta/thank-you");
      } else {
        const json = await res.json().catch(() => ({}));
        setApiError(json.error ?? "Something went wrong — please try again.");
      }
    } catch {
      setApiError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image src="/Alona.png" alt="AdonisBlue" width={44} height={44} className="rounded-xl" />
          <span className="text-base font-semibold tracking-tight text-[#1a2744]">AdonisBlue</span>
        </div>

        {/* Badge */}
        <div className="mb-5 flex justify-center">
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-[#0d9488]">
            Limited Beta • Only 5 Spots
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-balance text-center text-2xl font-bold leading-tight text-[#1a2744] sm:text-3xl">
          Busy with a client? <span className="text-[#0d9488]">Your messages don&apos;t have to wait.</span>
        </h1>

        {/* Subtext */}
        <p className="mb-6 text-center text-sm leading-relaxed text-slate-500">
          Apply to try AdonisBlue free for 1 month. It helps answer common client questions while you focus on the client in front of you.
        </p>

        {/* Benefits */}
        <ul className="mb-8 space-y-2.5">
          {[
            "Help clients get answers faster",
            "Stay focused during appointments",
            "We help set it up with you",
          ].map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm text-[#1a2744]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[#0d9488]">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {b}
            </li>
          ))}
        </ul>

        {/* Who this is for */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-1.5 text-sm font-bold text-[#1a2744]">Who this beta is for</p>
          <p className="text-sm leading-relaxed text-slate-500">
            We are looking for solo injectors and independent aesthetic providers who get client messages while they are busy, want a simpler way to handle common questions, and are open to sharing honest feedback.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md sm:p-8">
          <h2 className="mb-1 text-lg font-bold text-[#1a2744]">Apply for your free beta spot</h2>
          <p className="mb-6 text-sm text-slate-500">This takes about 3 minutes. We will review applications and contact selected beta members personally.</p>

          {summaryError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {summaryError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Full name */}
            <div className={FIELD} data-error={!!errors.full_name || undefined} ref={errors.full_name ? firstErrorRef : null}>
              <label className={LABEL}>Full name <span className="text-red-400">*</span></label>
              <input
                type="text"
                className={errors.full_name ? INPUT_ERROR : INPUT}
                value={fields.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="Jane Smith"
              />
              {errors.full_name && <p className="text-xs text-red-500">{errors.full_name}</p>}
            </div>

            {/* Business name */}
            <div className={FIELD} data-error={!!errors.business_name || undefined}>
              <label className={LABEL}>Business name <span className="text-red-400">*</span></label>
              <input
                type="text"
                className={errors.business_name ? INPUT_ERROR : INPUT}
                value={fields.business_name}
                onChange={(e) => set("business_name", e.target.value)}
                placeholder="Luxe Aesthetics"
              />
              {errors.business_name && <p className="text-xs text-red-500">{errors.business_name}</p>}
            </div>

            {/* Email */}
            <div className={FIELD} data-error={!!errors.email || undefined}>
              <label className={LABEL}>Email address <span className="text-red-400">*</span></label>
              <input
                type="email"
                className={errors.email ? INPUT_ERROR : INPUT}
                value={fields.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            {/* Instagram */}
            <div className={FIELD}>
              <label className={LABEL}>Instagram handle <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="text"
                className={INPUT}
                value={fields.instagram_handle}
                onChange={(e) => set("instagram_handle", e.target.value)}
                placeholder="@yourbusiness"
              />
            </div>

            {/* Provider type */}
            <div className={FIELD} data-error={!!errors.provider_type || undefined}>
              <label className={LABEL}>Do you work as a solo injector or independent aesthetic provider? <span className="text-red-400">*</span></label>
              <div className="space-y-2">
                {providerTypes.map((opt) => (
                  <OptionCard
                    key={opt}
                    label={opt}
                    selected={fields.provider_type === opt}
                    onClick={() => set("provider_type", opt)}
                  />
                ))}
              </div>
              {errors.provider_type && <p className="text-xs text-red-500">{errors.provider_type}</p>}
            </div>

            {/* Message frequency */}
            <div className={FIELD} data-error={!!errors.message_frequency || undefined}>
              <label className={LABEL}>How often do client messages come in while you are with a client? <span className="text-red-400">*</span></label>
              <div className="space-y-2">
                {frequencies.map((opt) => (
                  <OptionCard
                    key={opt}
                    label={opt}
                    selected={fields.message_frequency === opt}
                    onClick={() => set("message_frequency", opt)}
                  />
                ))}
              </div>
              {errors.message_frequency && <p className="text-xs text-red-500">{errors.message_frequency}</p>}
            </div>

            {/* Recent example */}
            <div className={FIELD} data-error={!!errors.recent_example || undefined}>
              <label className={LABEL}>Tell us about the last time a client messaged you while you were busy. What happened? <span className="text-red-400">*</span></label>
              <textarea
                className={errors.recent_example ? TEXTAREA_ERROR : TEXTAREA}
                rows={4}
                value={fields.recent_example}
                onChange={(e) => set("recent_example", e.target.value)}
                placeholder="For example: I was with a client and did not see the message until later."
              />
              {errors.recent_example && <p className="text-xs text-red-500">{errors.recent_example}</p>}
            </div>

            {/* Top time takers */}
            <div className={FIELD} data-error={!!errors.top_time_takers || undefined}>
              <label className={LABEL}>
                What client questions take up the most time? <span className="text-red-400">*</span>
                <span className="ml-1 font-normal text-slate-400">(Select up to 3)</span>
              </label>
              <div className="space-y-2">
                {timeTakerOptions.map((opt) => (
                  <CheckCard
                    key={opt}
                    label={opt}
                    checked={fields.top_time_takers.includes(opt)}
                    onClick={() => toggleCheck(opt)}
                    disabled={fields.top_time_takers.length >= 3 && !fields.top_time_takers.includes(opt)}
                  />
                ))}
              </div>
              {errors.top_time_takers && <p className="text-xs text-red-500">{errors.top_time_takers}</p>}
            </div>

            {/* Most wanted help */}
            <div className={FIELD} data-error={!!errors.most_wanted_help || undefined}>
              <label className={LABEL}>What is the one message task you most want help with? <span className="text-red-400">*</span></label>
              <textarea
                className={errors.most_wanted_help ? TEXTAREA_ERROR : TEXTAREA}
                rows={3}
                value={fields.most_wanted_help}
                onChange={(e) => set("most_wanted_help", e.target.value)}
              />
              {errors.most_wanted_help && <p className="text-xs text-red-500">{errors.most_wanted_help}</p>}
            </div>

            {/* Feedback willingness */}
            <div className={FIELD} data-error={!!errors.feedback_willingness || undefined}>
              <label className={LABEL}>Are you willing to share honest feedback and join two short check-ins during the free month? <span className="text-red-400">*</span></label>
              <div className="space-y-2">
                {feedbackOptions.map((opt) => (
                  <OptionCard
                    key={opt}
                    label={opt}
                    selected={fields.feedback_willingness === opt}
                    onClick={() => set("feedback_willingness", opt)}
                  />
                ))}
              </div>
              {errors.feedback_willingness && <p className="text-xs text-red-500">{errors.feedback_willingness}</p>}
            </div>

            {/* Why beta */}
            <div className={FIELD} data-error={!!errors.why_beta || undefined}>
              <label className={LABEL}>Why do you want to be part of the AdonisBlue beta? <span className="text-red-400">*</span></label>
              <textarea
                className={errors.why_beta ? TEXTAREA_ERROR : TEXTAREA}
                rows={4}
                value={fields.why_beta}
                onChange={(e) => set("why_beta", e.target.value)}
              />
              {errors.why_beta && <p className="text-xs text-red-500">{errors.why_beta}</p>}
            </div>

            {/* Dream feature */}
            <div className={FIELD}>
              <label className={LABEL}>If you could design the perfect tool to help with client messages, what would it do? <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                className={TEXTAREA}
                rows={3}
                value={fields.dream_feature}
                onChange={(e) => set("dream_feature", e.target.value)}
              />
            </div>

            {/* Agreement checkbox */}
            <div className={FIELD} data-error={!!errors.agreed || undefined}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={fields.agreed}
                  onChange={(e) => set("agreed", e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0d9488] focus:ring-[#0d9488]"
                />
                <span className="text-sm text-slate-600">
                  I understand this is a limited beta program, and AdonisBlue will contact selected applicants personally.
                </span>
              </label>
              {errors.agreed && <p className="text-xs text-red-500">{errors.agreed}</p>}
            </div>

            {/* API error */}
            {apiError && (
              <p className="text-center text-sm text-red-600">{apiError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0d9488] px-6 py-3.5 text-base font-bold text-white shadow-md shadow-teal-900/15 transition hover:bg-teal-700 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Apply for My Free Beta Spot"
              )}
            </button>

            <p className="text-center text-xs text-slate-400">No credit card needed. No tech skills needed. We will help you get started.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
