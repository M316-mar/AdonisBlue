"use client";

import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Those passwords do not match. Please try again.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError("We could not update your password. Please use the latest reset link from your email and try again.");
      return;
    }

    setSuccess("Your password has been updated. Redirecting you to your dashboard...");
    window.setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 antialiased">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="flex flex-col px-4 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          <Link href="/" className="mb-10 inline-flex w-fit shrink-0 items-center gap-1.5 sm:gap-2">
            <Image src="/Alona.png" alt="AdonisBlue Logo" width={52} height={52} />
            <span className="text-lg font-semibold tracking-tight text-[#1a2744] sm:text-xl">AdonisBlue</span>
          </Link>

          <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0d9488]">Reset password</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1a2744]">Create a new password</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Choose a new password for your AdonisBlue account.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                  New password
                </label>
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                  placeholder="Enter your new password"
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                  Confirm password
                </label>
                <input
                  id="confirm-new-password"
                  name="confirmNewPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                  placeholder="Confirm your new password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full rounded-full bg-[#0d9488] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
              {error ? (
                <p className="text-center text-sm leading-relaxed text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="text-center text-sm leading-relaxed text-[#0d9488]" role="status">
                  {success}
                </p>
              ) : null}
            </form>
          </main>
        </div>

        <aside className="relative hidden flex-col justify-center bg-[#1a2744] px-10 py-14 lg:flex xl:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_-10%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_60%_40%_at_10%_100%,rgba(13,148,136,0.14),transparent)]" aria-hidden />
          <div className="relative flex flex-col items-center text-center">
            <Image src="/Alona.png" alt="" width={120} height={120} className="opacity-95" />
            <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white">Welcome back</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-200">
              Reset your password and keep your AdonisBlue chatbot ready for your clients.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
