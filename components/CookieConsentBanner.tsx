"use client";

import { useEffect, useRef, useState } from "react";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("adonisblue_cookie_consent") !== "true") {
      setVisible(true);
    }
  }, []);

  // Reserve body space equal to the actual banner height so no content can
  // end up permanently stuck under the fixed banner when scrolled to the bottom.
  useEffect(() => {
    if (!visible) {
      document.body.style.paddingBottom = "";
      return;
    }
    const sync = () => {
      if (bannerRef.current) {
        document.body.style.paddingBottom = `${bannerRef.current.offsetHeight}px`;
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-3 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:flex-row sm:justify-between sm:px-6"
    >
        <p className="text-sm text-slate-600">
          We use cookies and similar tools to run this site. See our{" "}
          <a
            href="/privacy"
            className="underline text-teal-600 inline-flex min-h-[44px] items-center"
          >
            Privacy Policy
          </a>.
        </p>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("adonisblue_cookie_consent", "true");
            setVisible(false);
          }}
          className="shrink-0 min-h-[44px] w-full rounded-full bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 sm:w-auto"
        >
          Got it
        </button>
      </div>
  );
}
