"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const ADMIN_PASSWORD = "AdonisBlue2026!";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("adminAuth", "true");
      router.push("/admin");
      return;
    }
    setError("Incorrect password");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 font-sans text-[#1a2744] antialiased">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/Alona.png"
          alt="AdonisBlue"
          width={56}
          height={56}
          className="mx-auto h-14 w-14"
        />
        <p className="mt-3 text-base font-semibold tracking-tight">AdonisBlue</p>

        <form className="mt-10 space-y-4 text-left" onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Password"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#1a2744] outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/30"
          />
          {error ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-full bg-[#0d9488] px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
