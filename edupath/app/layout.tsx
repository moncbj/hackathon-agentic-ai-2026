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
      <body className="min-h-full flex flex-col bg-[#f8f9fd] text-slate-900 font-sans">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
            <a href="/dashboard" className="flex shrink-0 items-center gap-2 font-black tracking-tight text-slate-900"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-600 text-sm text-white">E</span><span>Edupath</span></a>
            <details className="relative hidden sm:block"><summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Explore⌄</summary><div className="absolute left-0 top-10 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><a href="/journey" className="block rounded-lg px-3 py-2 text-sm hover:bg-violet-50">Learning journey</a><a href="/notebooks" className="block rounded-lg px-3 py-2 text-sm hover:bg-violet-50">Notebooks</a></div></details>
            <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex"><a href="/journey" className="rounded-lg px-2 py-2 text-xs font-bold text-slate-600 hover:bg-violet-50">Journey</a><a href="/tutor" className="rounded-lg px-2 py-2 text-xs font-bold text-slate-600 hover:bg-violet-50">Tutor</a><a href="/progress" className="rounded-lg px-2 py-2 text-xs font-bold text-slate-600 hover:bg-violet-50">Progress</a><a href="/notebooks" className="rounded-lg px-2 py-2 text-xs font-bold text-slate-600 hover:bg-violet-50">Notebooks</a></nav>
            <label className="mx-auto hidden max-w-md flex-1 md:block"><span className="sr-only">Search subjects, skills, or lessons</span><input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100" placeholder="⌕  Search subjects, skills, or lessons…" /></label>
            <div className="ml-auto flex shrink-0 items-center gap-2 text-xs font-bold"><span className="hidden rounded-full bg-amber-50 px-2.5 py-1.5 text-amber-700 sm:inline">🔥 12 day streak</span><span className="hidden rounded-full bg-violet-50 px-2.5 py-1.5 text-violet-700 md:inline">⚡ 2,840 XP</span><details className="relative"><summary className="cursor-pointer list-none rounded-full bg-emerald-50 px-2 py-1.5 text-emerald-800">● Maya⌄</summary><div className="absolute right-0 top-9 w-36 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-lg"><a href="/progress" className="block rounded-lg px-2 py-2 hover:bg-slate-50">Profile</a></div></details></div>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </body>
    </html>
  );
}
