import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EduPath | Your learning map",
  description: "A playful, adaptive learning experience for future data analysts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f7f8f4] text-slate-900 font-sans">
        <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-10 backdrop-blur">
          <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <a href="/dashboard" className="text-xl font-black text-emerald-700 tracking-tight">EduPath</a>
            <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-600">
              <a className="hover:text-emerald-700" href="/dashboard">Learn</a>
              <a className="hover:text-emerald-700" href="/journey">My plan</a>
              <a className="hover:text-emerald-700" href="/progress">Progress</a>
              <a className="hover:text-emerald-700" href="/notebooks">Notebooks</a>
            </nav>
            <a href="/tutor" className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800">Ask your tutor</a>
          </div>
        </header>
        <main className="flex-1 w-full max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </body>
    </html>
  );
}
