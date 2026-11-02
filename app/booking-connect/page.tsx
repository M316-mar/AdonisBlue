"use client";

import Link from "next/link";
import { SideNavRail } from "@/components/SideNavRail";

export default function BookingConnectPage() {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <SideNavRail />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">📅</div>
          <h1 className="text-2xl font-semibold text-[#1a2744] mb-3">
            Booking software connection is coming soon
          </h1>
          <p className="text-[#475569] mb-8">
            For now, clients book through your booking link. You can set or
            update that link in your bot settings.
          </p>
          <Link
            href="/account"
            className="inline-block bg-[#1a2744] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#243461] transition-colors"
          >
            Back to Account
          </Link>
        </div>
      </main>
    </div>
  );
}
