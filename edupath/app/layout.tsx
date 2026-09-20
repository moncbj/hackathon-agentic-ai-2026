import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduPath · Your learning path",
  description: "An adaptive and verifiable learning path",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f7f8f4] text-slate-900 font-sans">
        <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-30 backdrop-blur">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
            <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0" aria-label="Ir al inicio de EduPath">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#14a36d] text-xl shadow-sm">✦</span>
              <span className="text-xl font-black tracking-tight text-slate-900">edu<span className="text-[#14a36d]">path</span></span>
            </Link>
            <nav className="hidden lg:flex items-center gap-1 text-sm font-bold text-slate-600" aria-label="Navegación principal">
              <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700" href="/dashboard">My map</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700" href="/journey">My plan</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700" href="/progress">Progress</Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700" href="/notebooks">Notebooks</Link>
            </nav>
            <Link href="/tutor" className="inline-flex items-center gap-2 rounded-xl bg-[#0d7a53] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#086343]">
              <span>✦</span> Ask your tutor
            </Link>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
