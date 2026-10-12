"use client";

import { useState, type FormEvent } from "react";

type Props = {
  token: string;
  practiceName: string;
  defaultDisplayName?: string;
};

export default function ReviewForm({ token, practiceName, defaultDisplayName = "" }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [okToShare, setOkToShare] = useState(false);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post-submit state
  const [done, setDone] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [googleLink, setGoogleLink] = useState<string | null>(null);
  const [facebookLink, setFacebookLink] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating == null) {
      setError("Please select a star rating before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          review_text: reviewText.trim() || null,
          ok_to_share: okToShare,
          display_name: displayName.trim() || null,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        emergency?: boolean;
        googleReviewLink?: string | null;
        facebookReviewLink?: string | null;
      };

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setEmergency(data.emergency ?? false);
      setGoogleLink(data.googleReviewLink ?? null);
      setFacebookLink(data.facebookReviewLink ?? null);
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    if (emergency) {
      return (
        <div className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <h1 className="text-xl font-bold text-red-700 sm:text-2xl">Please seek help right away</h1>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-700">
            Something in your message suggests you may be experiencing a medical concern. Please don't wait — reach out now.
          </p>
          <ul className="mb-6 space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <span className="text-red-500">📞</span>
              <span>Call <strong>911</strong> for a life-threatening emergency</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-500">🏥</span>
              <span>Go to the nearest <strong>emergency room</strong> if you need immediate care</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-500">💬</span>
              <span>Text <strong>HOME to 741741</strong> (Crisis Text Line) if you need to talk</span>
            </li>
          </ul>
          <p className="text-xs text-slate-500">Your provider has been notified and will be in touch. We care about you. 💙</p>
        </div>
      );
    }

    const reviewLinks = [
      googleLink ? { href: googleLink, label: "Leave a Google review", emoji: "⭐" } : null,
      facebookLink ? { href: facebookLink, label: "Leave a Facebook review", emoji: "💬" } : null,
    ].filter(Boolean).slice(0, 2) as { href: string; label: string; emoji: string }[];

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="py-4 text-center">
          <p className="text-4xl" aria-hidden>💙</p>
          <h1 className="mt-4 text-balance text-xl font-semibold leading-snug text-[#1a2744] sm:text-2xl">
            Thank you so much! Your feedback means the world 💙
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            We appreciate you taking a moment to share your experience with {practiceName}.
          </p>
          {reviewLinks.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-semibold text-[#1a2744]">One more thing — would you mind sharing on:</p>
              {reviewLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-[#1a2744] transition hover:bg-slate-100"
                >
                  <span>{link.emoji}</span>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8">
      <h1 className="text-balance text-center text-xl font-semibold leading-snug text-[#1a2744] sm:text-2xl">
        How was your experience? 🌸
      </h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        Your honest feedback helps {practiceName} keep getting better for you.
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {/* Star picker */}
        <div>
          <p className="mb-3 text-center text-sm font-medium text-[#1a2744]">Your rating</p>
          <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = rating != null && value <= rating;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  aria-pressed={rating === value}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition sm:h-14 sm:w-14 ${
                    selected
                      ? "border-[#0d9488] bg-teal-50 text-[#0d9488] shadow-md shadow-teal-900/10 ring-2 ring-[#0d9488]/30"
                      : "border-slate-200 bg-slate-50/80 text-slate-400 hover:border-teal-200 hover:bg-teal-50/50 hover:text-[#0d9488]"
                  }`}
                >
                  ★
                </button>
              );
            })}
          </div>
          {rating != null ? (
            <p className="mt-2 text-center text-xs font-medium text-[#0d9488]">{rating} of 5 stars</p>
          ) : null}
        </div>

        {/* Review text */}
        <div>
          <label htmlFor="review-text" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
            Tell us more (optional)
          </label>
          <textarea
            id="review-text"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={4}
            placeholder="What stood out to you? Anything we could do even better?"
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-[#1a2744] outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20"
          />
        </div>

        {/* Consent */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={okToShare}
            onChange={(e) => setOkToShare(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#0d9488]"
          />
          <span className="text-sm leading-relaxed text-slate-600">
            It&apos;s OK to share my review publicly (first name + last initial only)
          </span>
        </label>

        {okToShare && (
          <div>
            <label htmlFor="display-name" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
              Display name (optional)
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sarah M."
              maxLength={100}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-[#1a2744] outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20"
            />
          </div>
        )}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || rating == null}
          className="w-full rounded-full bg-[#0d9488] py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </form>
    </div>
  );
}
