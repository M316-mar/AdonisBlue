import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d1628] px-4 text-center">
      <Image src="/Alona.png" alt="AdonisBlue" width={64} height={64} className="mb-6 rounded-2xl" />
      <h1 className="text-2xl font-bold text-white sm:text-3xl">This page took a day off.</h1>
      <p className="mt-3 text-base text-slate-400">Let&apos;s get you back.</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-[#0d9488] px-8 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
      >
        Back to home
      </Link>
    </div>
  );
}
