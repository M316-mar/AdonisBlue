"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type NurseRow = {
  practice_name: string | null;
  bot_name: string | null;
  slug: string | null;
  launched: boolean | null;
  frozen: boolean | null;
  created_at: string;
  nurse_id: string;
};

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-practice";
}

function botSlug(row: NurseRow): string {
  if (row.slug?.trim()) return row.slug.trim();
  return slugify((row.bot_name || row.practice_name || "my-bot").trim());
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [freezeLoading, setFreezeLoading] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("adminAuth") !== "true") {
      router.replace("/admin-login");
      return;
    }
    fetch("/api/admin/nurses-public")
      .then(r => r.json())
      .then(json => {
        setNurses(Array.isArray(json.nurses) ? json.nurses : []);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [router]);

  const handleFreezeToggle = useCallback(async (nurse: NurseRow) => {
    const nextFrozen = !nurse.frozen;
    setFreezeLoading(nurse.nurse_id);
    try {
      const res = await fetch("/api/admin/freeze-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: nurse.nurse_id, frozen: nextFrozen }),
      });
      if (res.ok) {
        setNurses(prev => prev.map(n => n.nurse_id === nurse.nurse_id ? { ...n, frozen: nextFrozen } : n));
      }
    } finally {
      setFreezeLoading(null);
    }
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-[#1a2744]/80">Loading admin dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1a2744]/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={40} height={40} className="h-10 w-10" />
            <span className="text-base font-semibold text-white">AdonisBlue Admin</span>
          </div>
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem("adminAuth"); router.push("/"); }}
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >           Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md sm:p-6">
          <h1 className="text-lg font-semibold text-[#1a2744] sm:text-xl">All Nurses</h1>
          <p className="mt-1 text-sm text-slate-600">{nurses.length} registered bot{nurses.length !== 1 ? "s" : ""}</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">Practice</th>
                  <th className="pb-3 pr-4">Bot URL</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Joined</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nurses.map(nurse => (
                  <tr key={nurse.nurse_id} className="align-middle">
                    <td className="py-3 pr-4 font-medium text-[#1a2744]">{nurse.practice_name?.trim() || "—"}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/chat/${botSlug(nurse)}`} target="_blank" className="text-[#0d9488] hover:underline">
                        /chat/{botSlug(nurse)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${nurse.frozen ? "border-amber-200 bg-amber-50 text-amber-700" : nurse.launched ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {nurse.frozen ? "Frozen" : nurse.launched ? "Active" : "Not launched"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{new Date(nurse.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={freezeLoading === nurse.nurse_id}
                        onClick={() => void handleFreezeToggle(nurse)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${nurse.frozen ? "border border-teal-200 bg-teal-50 text-[#0d9488] hover:bg-teal-100" : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                      >
                        {freezeLoading === nurse.nurse_id ? "Saving…" : nurse.frozen ? "Unfreeze" : "Freeze"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {nurses.length === 0 && <p className="py-8 text-center texsm text-slate-500">No nurses yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
