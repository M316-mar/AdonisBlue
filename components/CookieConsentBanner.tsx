"use client";

import { useEffect, useState } from "react";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("adonisblue_cookie_consent") !== "true") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:flex-row sm:justify-between sm:px-6">
      <p className="text-sm text-slate-600">
        We use cookies and similar tools to run this site. See our{" "}
        <a href="/privacy" className="underline text-teal-600">Privacy Policy</a>.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("adonisblue_cookie_consent", "true");
          setVisible(false);
        }}
        className="shrink-0 rounded-full bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
      >
        Got it
      </button>
    </div>
  );
}
