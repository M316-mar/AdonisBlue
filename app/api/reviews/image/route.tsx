import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Normalize any Instagram input to just "@handle"
function normalizeInstagram(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // Strip protocol + www
  s = s.replace(/^https?:\/\/(www\.)?/i, "");
  // Strip instagram.com/
  s = s.replace(/^instagram\.com\//i, "");
  // Strip trailing slash and query string
  s = s.split("?")[0]!.replace(/\/+$/, "");
  // Strip leading @
  s = s.replace(/^@/, "");
  if (!s) return null;
  return "@" + s;
}

function StarSVGs({ rating }: { rating: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    stars.push(
      <svg
        key={i}
        width="52"
        height="52"
        viewBox="0 0 24 24"
        style={{ display: "block" }}
      >
        <polygon
          points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          fill={filled ? "#B7790A" : "none"}
          stroke={filled ? "#B7790A" : "#d1b06b"}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "6px" }}>
      {stars}
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAuth = createClient(url, anonKey);
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reviewId = new URL(request.url).searchParams.get("id");
    if (!reviewId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = createClient(url, serviceKey);

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("id, nurse_id, rating, review_text, display_name, ok_to_share, removed_at")
      .eq("id", reviewId)
      .maybeSingle();

    if (reviewError) {
      console.error("[api/reviews/image] review fetch error:", JSON.stringify(reviewError));
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (review.nurse_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!review.ok_to_share) return NextResponse.json({ error: "Not shareable" }, { status: 400 });
    if (review.removed_at) return NextResponse.json({ error: "Removed" }, { status: 410 });

    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("practice_name, instagram")
      .eq("nurse_id", user.id)
      .maybeSingle();
    if (botError) console.error("[api/reviews/image] bot fetch error:", JSON.stringify(botError));

    const practiceName = (bot?.practice_name as string | null | undefined) ?? "";
    const rawInstagram = (bot?.instagram as string | null | undefined) ?? "";
    const instagram = rawInstagram ? normalizeInstagram(rawInstagram) : null;
    const displayName = (review.display_name as string | null) ?? "Client";
    const reviewText = (review.review_text as string | null) ?? "";
    const rating = review.rating as number;

    return new ImageResponse(
      (
        <div
          style={{
            width: "1080px",
            height: "1350px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "#e8f5f2",
            padding: "80px",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "32px",
              padding: "72px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "32px",
              boxShadow: "0 8px 48px rgba(0,0,0,0.08)",
            }}
          >
            <StarSVGs rating={rating} />
            <p
              style={{
                fontSize: "40px",
                lineHeight: "1.5",
                color: "#1a2744",
                margin: "0",
                fontStyle: "italic",
              }}
            >
              &ldquo;{reviewText.slice(0, 300)}{reviewText.length > 300 ? "…" : ""}&rdquo;
            </p>
            <p style={{ fontSize: "30px", color: "#475569", margin: "0" }}>— {displayName}</p>
            <div
              style={{
                marginTop: "16px",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "32px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {practiceName ? (
                <p style={{ fontSize: "28px", fontWeight: "bold", color: "#1a2744", margin: "0" }}>{practiceName}</p>
              ) : null}
              {instagram ? (
                <p style={{ fontSize: "24px", color: "#0d9488", margin: "0" }}>{instagram}</p>
              ) : null}
              <p style={{ fontSize: "20px", color: "#94a3b8", margin: "0" }}>AdonisBlue</p>
            </div>
          </div>
        </div>
      ),
      { width: 1080, height: 1350 }
    );
  } catch (e) {
    console.error("[api/reviews/image] unexpected error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
