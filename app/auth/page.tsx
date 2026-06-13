"use client";

import { supabase } from "@/lib/supabase";
import type { AuthError } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

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
  const raw = `${error.message ?? ""} ${(error as { code?: string }).code ?? ""}`.toLowerCase();
  if (raw.includes("email not confirmed")) {
    return "Please confirm your email first — we sent you a link when you signed up.";
  }
  if (raw.includes("user not found") || raw.includes("no user") || raw.includes("email not found")) {
    return "We don't have an account for that email. Would you like to sign up instead?";
  }
  if (
    raw.includes("invalid login") ||
    raw.includes("invalid credentials") ||
    raw.includes("wrong password")
  ) {
    return "Hmm, that email or password doesn't look right — want to try again?";
  }
  return "We couldn't sign you in right now. Please try again in a moment.";
}

function PasswordToggleButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const redirectAfterLogin = useRef<string>("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      setConfirmed(true);
      setMode("login");
    }
    if (params.get("reason") === "timeout") {
      setSessionTimedOut(true);
      setMode("login");
    }
    const redirect = params.get("redirect");
    if (redirect && redirect.startsWith("/")) {
      redirectAfterLogin.current = redirect;
    }
  }, []);

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

    router.push(redirectAfterLogin.current);
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
              signupSuccessMessage ? (
                <div className="mt-8 text-center">
                  <p className="text-4xl">🦋</p>
                  <h2 className="mt-4 text-xl font-semibold text-[#1a2744]">You&apos;re in!</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#0d9488]">{signupSuccessMessage}</p>
                  <p className="mt-4 text-sm text-slate-600">Check your email and click the confirmation link to get started.</p>
                  <button
                    type="button"
                    onClick={() => switchToLogin()}
                    className="mt-6 text-sm font-semibold text-[#0d9488] hover:underline"
                  >
                    Already confirmed? Log in →
                  </button>
                </div>
              ) : (
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
                    <div className="relative">
                      <input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                        placeholder="Create a strong password"
                      />
                      <PasswordToggleButton visible={showPassword} onToggle={() => setShowPassword((p) => !p)} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-confirm" className="mb-1.5 block text-sm font-medium text-[#1a2744]">
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        id="signup-confirm"
                        name="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                        placeholder="Confirm your password"
                      />
                      <PasswordToggleButton visible={showConfirm} onToggle={() => setShowConfirm((p) => !p)} />
                    </div>
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
                  <p className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-center text-sm leading-relaxed text-slate-600">
                    We know you work hard and have many options. We&apos;re honored you chose AdonisBlue. We&apos;re here to make sure every client who finds you feels as confident as the ones who already love your work. 💙
                  </p>
                  <p className="text-center text-sm text-slate-600">
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchToLogin()} className="font-semibold text-[#0d9488] hover:underline">
                      Log in
                    </button>
                  </p>
                </form>
              )
            ) : (
              <>
              <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
                {confirmed && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-green-700">✅ Email confirmed! Log in below to get started.</p>
                  </div>
                )}
                {sessionTimedOut && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-amber-700">⏱️ Your session expired after 30 minutes of inactivity. Please log in again.</p>
                  </div>
                )}
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
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-[#1a2744] outline-none ring-[#0d9488]/30 transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2"
                      placeholder="Your password"
                    />
                    <PasswordToggleButton visible={showLoginPassword} onToggle={() => setShowLoginPassword((p) => !p)} />
                  </div>
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
        </aside>
      </div>
    </div>
  );
}
