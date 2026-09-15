"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "Home" },
  { href: "/aftercare", icon: "🩹", label: "Log" },
  { href: "/checkin", icon: "📞", label: "Check-Ins" },
  { href: "/insights", icon: "📊", label: "Insights" },
  { href: "/client-journey", icon: "✉️", label: "Emails" },
  { href: "/offers", icon: "🎁", label: "Offers" },
  { href: "/booking-connect", icon: "🔗", label: "Booking" },
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
      </nav>

      {/* ── Bottom bar — mobile (< sm) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
    </>
  );
}
