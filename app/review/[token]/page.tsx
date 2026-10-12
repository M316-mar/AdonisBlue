import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import ReviewForm from "./ReviewForm";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ReviewPage({ params }: PageProps) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: intake } = await supabase
    .from("intakes")
    .select("id, review_submitted_at, nurse_id, first_name, bots(practice_name)")
    .eq("review_token", token)
    .single();

  const practiceName =
    (intake?.bots as { practice_name?: string } | null)?.practice_name || "your provider";

  // Build a default display name: "First L." if we have a last word, else just first name
  let defaultDisplayName = "";
  if (intake?.first_name) {
    const parts = intake.first_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      defaultDisplayName = `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
    } else {
      defaultDisplayName = parts[0];
    }
  }

  // Invalid token
  if (!intake) {
    return <InvalidPage message="This review link isn't valid. It may have expired or never existed." />;
  }

  // Already used
  if (intake.review_submitted_at) {
    return <InvalidPage message="This review has already been submitted — thank you so much! 💙" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-[#1a2744] antialiased">
      <header className="border-b border-sky-100 bg-white shadow-sm shadow-sky-100/60">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-2 px-4 py-4">
          <Image src="/Alona.png" alt="AdonisBlue" width={40} height={40} className="h-10 w-10" />
          <span className="text-base font-semibold tracking-tight text-[#1a2744]">{practiceName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8 sm:py-12">
        <ReviewForm token={token} practiceName={practiceName} defaultDisplayName={defaultDisplayName} />
      </main>
    </div>
  );
}

function InvalidPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <header className="border-b border-sky-100 bg-white shadow-sm shadow-sky-100/60">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-2 px-4 py-4">
          <Image src="/Alona.png" alt="AdonisBlue" width={40} height={40} className="h-10 w-10" />
          <span className="text-base font-semibold tracking-tight text-[#1a2744]">AdonisBlue</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <p className="text-4xl" aria-hidden>💙</p>
        <p className="mt-6 text-base leading-relaxed text-slate-600">{message}</p>
      </main>
    </div>
  );
}
