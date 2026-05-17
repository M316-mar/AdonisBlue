"use client";

import { supabase } from "@/lib/supabase";
import type { AuthError } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function friendlySignupError(error: AuthError): string {
  const raw = `${error.message ?? ""} ${(error as { code?: string }).code ?? ""}`.toLowerCase();
  if (
    raw.includes("already registered") ||
    raw.includes("user already") ||
    raw.includes("already exists") ||
    raw.includes("email address is already") ||
    raw.includes("duplicate")
  ) {
    return "Looks like you already have an account! Try logging in instead.";
  }
  if (raw.includes("password") && (raw.includes("weak") || raw.includes("short") || raw.includes("least"))) {
    return "Your password needs to be a bit stronger — try a longer mix of letters and numbers.";
  }
  return "Something went wrong while creating your account. Please try again.";
}

function friendlyLoginError(error: AuthError): string {
  const raw = `${error.message ?? ""}`.toLowerCase();
  if (raw.includes("email not confirmed")) {
    return "Please confirm your email first — we sent you a link when you signed up.";
  }
  if (
    raw.includes("invalid login") ||
    raw.includes("invalid credentials") ||
    raw.includes("wrong password")
  ) {
    return "Hmm that password doesn't look right — want to try again?";
  }
  return "We couldn't sign you in right now. Please try again in a moment.";
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [signupSuccessMessage, setSignupSuccessMessage] = useState<string | null>(null);

  function switchToSignup() {
    setMode("signup");
    setLoginError(null);
  }

  function switchToLogin() {
    setMode("login");
    setSignupError(null);
    setSignupSuccessMessage(null);
  }

  async function handlePasswordResetSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetError(null);
    setResetSuccessMessage(null);

    if (!resetEmail.trim()) {
      setResetError("Please enter the email address for your account.");
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: "https://www.adonisblue.io/auth/reset-password",
    });
    setResetLoading(false);

    if (error) {
      setResetError("We couldn't send the reset link right now. Please check your email and try again.");
      return;
    }

    setResetSuccessMessage("Check your email! We sent you a reset link.");
  }

  async function handleSignupSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSignupError(null);
    setSignupSuccessMessage(null);

    if (!termsAccepted) {
      setSignupError("Please agree to the terms to continue.");
      return;
    }
    if (!signupEmail.trim() || !signupPassword) {
      setSignupError("Please enter your email and password.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError("Those passwords don't match — double-check and try again.");
      return;
    }

    setSignupLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        data: {
          full_name: signupName.trim(),
        },
      },
    });
    setSignupLoading(false);

    if (error) {
      setSignupError(friendlySignupError(error));
      return;
    }

    setSignupSuccessMessage("Welcome to AdonisBlue! Please check your email to confirm your account.");
  }

  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }

    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setLoginLoading(false);

    if (error) {
      setLoginError(friendlyLoginError(error));
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-full bg-white font-sans text-slate-800 antialiased">
      <div className="grid min-h-full lg:grid-cols-2">
        <div className="flex flex-col px-4 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          <Link href="/" className="mb-10 inline-flex w-fit shrink-0 items-center gap-1.5 sm:gap-2">
            <Image src="/Alona.png" alt="AdonisBlue Logo" width={52} height={52} />
            <span className="text-lg font-semibold tracking-tight text-[#1a2744] sm:text-xl">AdonisBlue</span>
          </Link>

          <div className="mx-auto w-full max-w-md flex-1">
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => switchToSignup()}
                className={`relative flex-1 pb-3 text-center text-sm font-semibold transition sm:text-base ${
                  mode === "signup" ? "text-[#1a2744]" : "text-slate-500 hover:text-[#1a2744]"
                }`}
              >
                Sign Up
                {mode === "signup" ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d9488]" aria-hidden />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => switchToLogin()}
                className={`relative flex-1 pb-3 text-center text-sm font-semibold transition sm:text-base ${
                  mode === "login" ? "text-[#1a2744]" : "text-slate-500 hover:text-[#1a2744]"
                }`}
              >
                Log In
                {mode === "login" ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d9488]" aria-hidden />
                ) : null}
              </button>
            </div>

            {mode === "signup" ? (
              <form className="mt-8 space-y-5" onSubmit={handleSignupSubmit}>
                <div>
                  <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Email address
                  </label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="you@practice.com"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="Create a strong password"
                  />
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Confirm password
                  </label>
                  <input
                    id="signup-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="Confirm your password"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0d9488] focus:ring-[#0d9488]"
                  />
                  <span className="text-sm leading-snug text-slate-600">
                    I agree to keep my clients privacy and AdonisBlue terms
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={signupLoading}
                  aria-busy={signupLoading}
                  className="mt-2 w-full rounded-full bg-[#0d9488] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
                >
                  {signupLoading ? "Creating your account..." : "Create my account"}
                </button>
                {signupError ? (
                  <p className="text-center text-sm leading-relaxed text-red-600" role="alert">
                    {signupError}
                  </p>
                ) : null}
                {signupSuccessMessage ? (
                  <p className="text-center text-sm leading-relaxed text-[#0d9488]" role="status">
                    {signupSuccessMessage}
                  </p>
                ) : null}
                <p className="text-center text-sm text-slate-600">
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchToLogin()} className="font-semibold text-[#0d9488] hover:underline">
                    Log in
                  </button>
                </p>
              </form>
            ) : (
              <>
              <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="you@practice.com"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="login-password" className="text-sm font-medium text-[#1a2744]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOpen((open) => !open);
                        setResetEmail(loginEmail);
                        setResetError(null);
                        setResetSuccessMessage(null);
                      }}
                      className="text-xs font-medium text-[#0d9488] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="Your password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  aria-busy={loginLoading}
                  className="mt-2 w-full rounded-full bg-[#0d9488] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
                >
                  {loginLoading ? "Logging in..." : "Welcome back"}
                </button>
                {loginError ? (
                  <p className="text-center text-sm leading-relaxed text-red-600" role="alert">
                    {loginError}
                  </p>
                ) : null}
                <p className="text-center text-sm text-slate-600">
                  New to AdonisBlue?{" "}
                  <button type="button" onClick={() => switchToSignup()} className="font-semibold text-[#0d9488] hover:underline">
                    Sign up free
                  </button>
                </p>
              </form>
              {forgotOpen ? (
                <form
                  className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4"
                  onSubmit={handlePasswordResetSubmit}
                >
                  <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                    Email for password reset
                  </label>
                  <input
                    id="reset-email"
                    name="resetEmail"
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                    placeholder="you@practice.com"
                  />
                  <button
                    type="submit"
                    disabled={resetLoading}
                    aria-busy={resetLoading}
                    className="mt-3 w-full rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {resetLoading ? "Sending..." : "Send reset link"}
                  </button>
                  {resetError ? (
                    <p className="mt-3 text-center text-sm leading-relaxed text-red-600" role="alert">
                      {resetError}
                    </p>
                  ) : null}
                  {resetSuccessMessage ? (
                    <p className="mt-3 text-center text-sm leading-relaxed text-[#0d9488]" role="status">
                      {resetSuccessMessage}
                    </p>
                  ) : null}
                </form>
              ) : null}
              </>
            )}
          </div>
        </div>

        <aside className="relative hidden flex-col justify-between bg-[#1a2744] px-10 py-14 lg:flex xl:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_-10%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_60%_40%_at_10%_100%,rgba(13,148,136,0.14),transparent)]" aria-hidden />
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-8 flex justify-center">
              <Image src="/Alona.png" alt="" width={120} height={120} className="opacity-95" />
            </div>
            <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Tech<span className="text-[#38bdf8]">.</span> that cares
            </p>
          </div>
          <ul className="relative mt-12 space-y-6 border-t border-white/10 pt-10 text-left">
            <li className="text-sm leading-relaxed text-slate-200">
              <span className="font-semibold text-white">Sarah M.</span>
              <span className="text-slate-400"> — </span>I never miss a client question anymore.
            </li>
            <li className="text-sm leading-relaxed text-slate-200">
              <span className="font-semibold text-white">Jessica R.</span>
              <span className="text-slate-400"> — </span>My clients think I have a full team.
            </li>
            <li className="text-sm leading-relaxed text-slate-200">
              <span className="font-semibold text-white">Maria L.</span>
              <span className="text-slate-400"> — </span>Best investment I made for my practice.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
