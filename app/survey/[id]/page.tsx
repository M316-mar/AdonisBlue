"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SurveyPage() {
  const params = useParams();
  const intakeId = typeof params?.id === "string" ? params.id : "";

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!intakeId || rating == null) {
      setError("Please select a star rating before submitting.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/submit-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake_id: intakeId,
          rating,
          comment: comment.trim(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!intakeId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-600">This survey link is not valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-[#1a2744] antialiased">
      <header className="border-b border-sky-100 bg-white shadow-sm shadow-sky-100/60">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-2 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={40} height={40} className="h-10 w-10" />
            <span className="text-base font-semibold tracking-tight text-[#1a2744]">AdonisBlue</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8">
          {submitted ? (
            <div className="py-6 text-center">
              <p className="text-4xl" aria-hidden>
                💙
              </p>
              <h1 className="mt-4 text-balance text-xl font-semibold leading-snug text-[#1a2744] sm:text-2xl">
                Thank you so much! Your feedback means the world 💙
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                We appreciate you taking a moment to share your experience.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-center text-balance text-xl font-semibold leading-snug text-[#1a2744] sm:text-2xl">
                How was your experience? 🌸
              </h1>
              <p className="mt-2 text-center text-sm text-slate-600">
                Your honest feedback helps us keep getting better for you.
              </p>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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

                <div>
                  <label htmlFor="survey-comment" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Tell us more (optional)
                  </label>
                  <textarea
                    id="survey-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="What stood out to you? Anything we could do even better?"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-[#1a2744] outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20"
                  />
                </div>

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
                  {submitting ? "Submitting…" : "Submit feedback"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
