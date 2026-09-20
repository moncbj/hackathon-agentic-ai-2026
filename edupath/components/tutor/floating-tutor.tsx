"use client";

// components/tutor/floating-tutor.tsx
// Floating Tutor button and slide-over panel for application-wide assistance (SPEC-005 §3.5)

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { TutorChat } from "./tutor-chat";

export function FloatingTutor() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Hide floating button on the dedicated full-page /tutor route
  if (pathname === "/tutor") {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open personal AI tutor"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-xl hover:bg-emerald-800 hover:scale-105 transition-all"
        >
          <span className="text-base">✦</span>
          <span>Ask Tutor</span>
        </button>
      )}

      {/* Slide-over Drawer / Floating Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/30 backdrop-blur-sm sm:p-6 transition-all">
          <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="flex items-center justify-between bg-emerald-800 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 text-sm font-black">
                  ✦
                </span>
                <div>
                  <h2 className="text-sm font-bold leading-tight">EduPath Tutor</h2>
                  <p className="text-[11px] text-emerald-200">
                    Always here to help you understand your path
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition"
                aria-label="Close tutor panel"
              >
                ✕
              </button>
            </div>

            {/* Embedded Compact Chat */}
            <TutorChat isCompact />
          </div>
        </div>
      )}
    </>
  );
}
