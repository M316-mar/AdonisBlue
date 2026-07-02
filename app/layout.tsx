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
  title: "AdonisBlue — AI Front Desk for Nurse Injectors",
  description: "AdonisBlue is your AI-powered front desk built for nurse injectors. Answer client questions 24/7, capture leads, and never miss a booking again.",
  icons: {
    icon: [
      { url: "/Alona.png", type: "image/png" },
    ],
    apple: "/Alona.png",
    shortcut: "/Alona.png",
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
