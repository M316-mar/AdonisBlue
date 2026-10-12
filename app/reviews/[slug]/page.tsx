import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

type Params = { params: Promise<{ slug: string }> };

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  display_name: string | null;
  created_at: string;
};

type Bot = {
  id: string;
  nurse_id: string;
  practice_name: string | null;
  booking_link: string | null;
  slug: string | null;
};

function Stars({ n }: { n: number }) {
  return (
    <span style={{ color: "#f59e0b" }}>
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? (parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")
    : (parts[0]?.[0] ?? "?");
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-[#1a2744] text-sm font-bold text-white">
      {letters.toUpperCase()}
    </div>
  );
}

export default async function PublicReviewsPage({ params }: Params) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the bot by slug
  const { data: bot, error: botError } = await supabase
    .from("bots")
    .select("id, nurse_id, practice_name, booking_link, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (botError) {
    console.error("[reviews/[slug]] bot fetch error:", JSON.stringify(botError));
  }

  if (!bot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1a2744]">Page not found</p>
          <p className="mt-2 text-sm text-slate-500">We couldn&apos;t find a reviews page for this practice.</p>
          <a href="https://adonisblue.io" className="mt-6 inline-block text-sm font-semibold text-[#0d9488] underline decoration-dotted">
            Learn about AdonisBlue
          </a>
        </div>
      </div>
    );
  }

  // Fetch ALL non-removed reviews for count/avg (honest numbers)
  const { data: allReviews, error: allError } = await supabase
    .from("reviews")
    .select("id, rating")
    .eq("nurse_id", bot.nurse_id)
    .is("removed_at", null);

  if (allError) {
    console.error("[reviews/[slug]] allReviews fetch error:", JSON.stringify(allError));
  }

  // Fetch only public (featured + ok_to_share + not removed) for display
  const { data: publicReviews, error: pubError } = await supabase
    .from("reviews")
    .select("id, rating, review_text, display_name, created_at")
    .eq("nurse_id", bot.nurse_id)
    .eq("featured", true)
    .eq("ok_to_share", true)
    .is("removed_at", null)
    .order("created_at", { ascending: false });

  if (pubError) {
    console.error("[reviews/[slug]] publicReviews fetch error:", JSON.stringify(pubError));
  }

  const reviewList = (publicReviews ?? []) as Review[];
  const allList = (allReviews ?? []);
  const totalCount = allList.length;
  const avgRating = totalCount > 0
    ? allList.reduce((s, r) => s + (r.rating as number), 0) / totalCount
    : null;

  const practiceName = (bot as Bot).practice_name ?? "This practice";
  const bookingLink = (bot as Bot).booking_link ?? null;
  const chatSlug = (bot as Bot).slug ?? slug;

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="bg-[#1a2744] px-4 py-6 text-center">
        <p className="text-base font-bold text-white">{practiceName}</p>
        {avgRating != null && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Stars n={Math.round(avgRating)} />
            <span className="text-sm font-semibold text-white">{avgRating.toFixed(1)}</span>
            <span className="text-xs text-white/70">from {totalCount} client review{totalCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 pb-20">
        {/* CTA buttons */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {bookingLink && (
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#0d9488] px-6 py-3 text-center text-sm font-semibold text-white shadow hover:bg-teal-700 transition"
            >
              Book your visit
            </a>
          )}
          <Link
            href={`/chat/${chatSlug}`}
            className="rounded-full border border-[#1a2744] px-6 py-3 text-center text-sm font-semibold text-[#1a2744] hover:bg-[#1a2744]/5 transition"
          >
            Have a question? Chat with us 24/7
          </Link>
        </div>

        {/* Reviews list */}
        {reviewList.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No public reviews yet.
          </div>
        ) : (
          <div className="space-y-4">
            {reviewList.map((review) => (
              <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Initials name={review.display_name || "Client"} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a2744]">{review.display_name || "Client"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Stars n={review.rating} />
                      <span className="text-xs text-slate-400">
                        {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
                {review.review_text && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{review.review_text}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 border-t border-slate-200 pt-6 text-center">
          <p className="text-xs text-slate-400">
            Showing reviews clients agreed to share. Verified through AdonisBlue after a real visit.
          </p>
          <a
            href="https://adonisblue.io"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs font-semibold text-[#0d9488]"
          >
            Powered by AdonisBlue
          </a>
        </div>
      </main>
    </div>
  );
}
