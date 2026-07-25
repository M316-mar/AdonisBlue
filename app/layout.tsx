import type { Metadata } from "next";
import { DM_Sans, Geist, Geist_Mono, Inter, Nunito, Playfair_Display } from "next/font/google";
import { Suspense } from "react";
import ActivityTracker from "@/components/ActivityTracker";
import SessionSync from "@/components/SessionSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const botFontDmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-bot-dm-sans",
});

const botFontPlayfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-bot-playfair",
});

const botFontInter = Inter({
  subsets: ["latin"],
  variable: "--font-bot-inter",
});

const botFontNunito = Nunito({
  subsets: ["latin"],
  variable: "--font-bot-nunito",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.adonisblue.io"),
  title: "AdonisBlue — Keep Your Clients Coming Back",
  description: "AdonisBlue helps nurse injectors keep clients coming back with automatic aftercare, healing check-ins, and follow-up that makes every client feel cared for — not just treated.",
  icons: {
    icon: [
      { url: "/Alona.png", type: "image/png" },
    ],
    apple: "/Alona.png",
    shortcut: "/Alona.png",
  },
  openGraph: {
    title: "AdonisBlue — Keep Your Clients Coming Back",
    description: "Automatic aftercare, healing check-ins, and follow-up that makes every client feel cared for — not just treated.",
    url: "https://www.adonisblue.io",
    siteName: "AdonisBlue",
    images: [{ url: "/Alona.png", width: 512, height: 512, alt: "AdonisBlue" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AdonisBlue — Keep Your Clients Coming Back",
    description: "Automatic aftercare, healing check-ins, and follow-up that makes every client feel cared for — not just treated.",
    images: ["/Alona.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${botFontDmSans.variable} ${botFontPlayfair.variable} ${botFontInter.variable} ${botFontNunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ActivityTracker />
        {/* SessionSync needs Suspense because it calls useSearchParams() */}
        <Suspense fallback={null}>
          <SessionSync />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
