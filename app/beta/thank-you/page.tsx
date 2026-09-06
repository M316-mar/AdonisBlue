export default function BetaThankYou() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-4xl">
          🦋
        </div>
        <h1 className="mb-3 text-2xl font-bold text-[#1a2744] sm:text-3xl">You&apos;re on the list!</h1>
        <p className="mb-5 text-sm leading-relaxed text-slate-500">
          Thank you for applying for an AdonisBlue beta spot. We are reviewing a small number of applications and will contact selected providers by email soon.
        </p>
        <p className="mb-2 text-sm text-slate-400">Please check your inbox and spam folder.</p>
        <p className="text-sm text-slate-400">
          Want to introduce yourself sooner? Follow us on Instagram or reply to our email when it arrives.
        </p>
      </div>
    </div>
  );
}
