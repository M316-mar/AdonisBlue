"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function NurseAvatar({ initial, href }: { initial: string; href: string }) {
  return (
    <Link
      href={href}
      aria-label="My Account"
      className="flex flex-col items-center gap-1 py-2 px-1"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a2744] text-sm font-bold text-white transition hover:bg-[#0d9488] select-none">
        {initial}
      </span>
      <span className="text-[10px] font-semibold leading-tight text-slate-400">Account</span>
    </Link>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "Home" },
  { href: "/aftercare", icon: "🩹", label: "Log" },
  { href: "/checkin", icon: "📞", label: "Check-Ins" },
  { href: "/client-journey", icon: "✉️", label: "Emails" },
  { href: "/offers", icon: "🎁", label: "Offers" },
  { href: "/booking-connect", icon: "🔗", label: "Booking" },
  { href: "/insights", icon: "📊", label: "Insights" },
] as const;

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 py-2 px-1"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition ${
          active ? "bg-teal-600 text-white shadow-md shadow-teal-900/20" : "bg-teal-50 text-slate-600 hover:bg-teal-100"
        }`}
      >
        {icon}
      </span>
      <span className={`text-[10px] font-semibold leading-tight ${active ? "text-teal-600" : "text-slate-400"}`}>
        {label}
      </span>
    </Link>
  );
}

export function SideNavRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState(0);
  const [nurseInitial, setNurseInitial] = useState("·");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || cancelled) return;
        const [notifRes, accountRes] = await Promise.all([
          fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!cancelled && notifRes.ok) {
          const json = await notifRes.json() as { count?: number };
          setAlertCount(json.count ?? 0);
        }
        if (!cancelled && accountRes.ok) {
          const a = await accountRes.json() as { nurse_name?: string };
          const name = a.nurse_name?.trim() ?? "";
          if (name) setNurseInitial(name[0].toUpperCase());
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleBellClick = () => {
    if (pathname === "/dashboard") {
      const el = document.getElementById("assistant-panel");
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push("/dashboard#assistant");
    }
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {/* ── Left rail — desktop (sm+) ── */}
      <nav className="hidden sm:flex w-20 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-4 fixed top-0 left-0 h-full z-40">
        <Link href="/dashboard" className="mb-3 mt-1">
          <Image src="/Alona.png" alt="AdonisBlue" width={36} height={36} className="rounded-xl" />
        </Link>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
        {/* Bell — alerts */}
        <button
          type="button"
          onClick={handleBellClick}
          aria-label={alertCount > 0 ? `${alertCount} unhandled alert${alertCount !== 1 ? "s" : ""}` : "No alerts"}
          className="relative mt-1 flex flex-col items-center gap-1 py-2 px-1"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-lg text-slate-600 transition hover:bg-teal-100">
            🔔
            {alertCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {alertCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold leading-tight text-slate-400">Alerts</span>
        </button>
        {/* Account avatar — bottom of rail */}
        <div className="mt-auto">
          <NurseAvatar initial={nurseInitial} href="/account" />
        </div>
      </nav>

      {/* ── Mobile account avatar — top-right ── */}
      <Link
        href="/account"
        aria-label="My Account"
        className="sm:hidden fixed top-3 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-[#1a2744] text-sm font-bold text-white shadow transition hover:bg-[#0d9488] select-none"
      >
        {nurseInitial}
      </Link>

      {/* ── Bottom bar — mobile (< sm) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
    </>
  );
}
