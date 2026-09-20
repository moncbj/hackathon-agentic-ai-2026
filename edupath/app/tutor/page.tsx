"use client";

// app/tutor/page.tsx
// Dedicated Tutor Chat page (SPEC-005 §3.5)

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TutorChat } from "@/components/tutor/tutor-chat";

function TutorPageContent() {
  const searchParams = useSearchParams();
  const skillSlug = searchParams.get("skillSlug") || searchParams.get("skill") || undefined;
  const notebookId = searchParams.get("notebookId") || searchParams.get("id") || undefined;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="rounded-3xl bg-gradient-to-br from-emerald-800 to-teal-700 p-6 sm:p-8 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-200">
          Personal learning companion
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
          Your EduPath Tutor
        </h1>
        <p className="mt-1 text-sm text-emerald-100 max-w-xl">
          Ask questions about your learning plan, dive deep into concepts with real-world analogies,
          or discuss your study notes in a style tailored to you.
        </p>
      </header>

      <TutorChat initialSkillSlug={skillSlug} initialNotebookId={notebookId} />
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto h-[600px] rounded-3xl bg-slate-100 animate-pulse" />
      }
    >
      <TutorPageContent />
    </Suspense>
  );
}
