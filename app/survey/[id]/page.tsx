import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Image from "next/image";
import crypto from "crypto";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyRedirectPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: intake } = await supabase
    .from("intakes")
    .select("id, survey_sent, review_token, review_submitted_at")
    .eq("id", id)
    .single();

  if (!intake) {
    return <Message text="This survey link isn't valid." />;
  }

  if (intake.review_submitted_at) {
    return <Message text="This review has already been submitted — thank you so much! 💙" />;
  }

  // Ensure a review_token exists
  let token: string = intake.review_token;
  if (!token) {
    token = crypto.randomBytes(32).toString("base64url");
    await supabase.from("intakes").update({ review_token: token }).eq("id", id);
  }

  redirect(`/review/${token}`);
}

function Message({ text }: { text: string }) {
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
        <p className="mt-6 text-base leading-relaxed text-slate-600">{text}</p>
      </main>
    </div>
  );
}
