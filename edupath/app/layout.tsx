import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EduPath",
  description: "An AI-powered personalized learning platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center">
            <h1 className="text-xl font-bold text-indigo-600 tracking-tight">EduPath</h1>
          </div>
        </header>
        <main className="flex-1 w-full max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </body>
    </html>
  );
}
