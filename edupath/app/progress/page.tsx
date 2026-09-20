"use client";

// app/progress/page.tsx
// Progress Report interface with four visual blocks and AI narrative (SPEC-005 §3.2, §3.5)

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProgressReportResult } from "@/domain/report";
import { ReportRecord } from "@/lib/db/repositories/reports";

export default function ProgressPage() {
  const [currentReport, setCurrentReport] = useState<ReportRecord | null>(null);
  const [historyReports, setHistoryReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      try {
        const res = await fetch("/api/reports");
        if (!res.ok) {
          if (res.status === 404) {
            if (active) {
              setCurrentReport(null);
              setLoading(false);
            }
            return;
          }
          throw new Error("Failed to load progress reports");
        }

        const list: ReportRecord[] = await res.json();
        if (active) {
          if (Array.isArray(list) && list.length > 0) {
            setCurrentReport(list[0]);
            setHistoryReports(list);
            setLoading(false);
          } else {
            // No report yet; automatically generate initial one
            const genRes = await fetch("/api/reports", { method: "POST" });
            if (genRes.ok) {
              const newReport: ReportRecord = await genRes.json();
              if (active) {
                setCurrentReport(newReport);
                setHistoryReports([newReport]);
              }
            }
            if (active) {
              setLoading(false);
            }
          }
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error loading reports");
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, []);

  async function handleGenerateReport() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to generate report");
      }

      const newReport: ReportRecord = await res.json();
      setCurrentReport(newReport);
      setHistoryReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)].slice(0, 5));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating report");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-44 rounded-3xl bg-slate-200" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const data: ProgressReportResult | undefined = currentReport?.data;
  const narrative = currentReport?.narrative;

  return (
    <div className="space-y-7 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
            Growth & Competencies
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900 tracking-tight">
            Your Progress Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Objective measurement of acquired skills, active gaps, and recommended next steps.
          </p>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateReport}
          className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {generating ? "Synthesizing report..." : "✦ Generate fresh report"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-rose-700">✕</button>
        </div>
      )}

      {narrative && (
        <section className="rounded-3xl bg-gradient-to-br from-violet-800 to-indigo-900 p-6 sm:p-8 text-white shadow-md">
          <div className="flex items-center gap-2 text-violet-200 text-xs font-black uppercase tracking-wider">
            <span>✦ Tutor Synthesis</span>
            {currentReport?.created_at && (
              <span>· {new Date(currentReport.created_at).toLocaleDateString()}</span>
            )}
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-white">
            {narrative.headline}
          </h2>
          <p className="mt-2 text-sm text-violet-100 max-w-3xl leading-relaxed">
            {narrative.narrative}
          </p>
        </section>
      )}

      {/* The 4 Major Core Visual Blocks */}
      {data && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Acquired */}
          <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800 font-black text-base">
                  ✓
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {data.acquired.length} skills
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900">Acquired</h3>
              <p className="mt-1 text-xs text-slate-500">Skills meeting required level.</p>

              <div className="mt-4 space-y-2">
                {data.acquired.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No skills fully acquired yet.</p>
                ) : (
                  data.acquired.map((s) => (
                    <div
                      key={s.slug}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs"
                    >
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          s.verification === "verified"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {s.verification === "verified" ? "Verified" : "Self-rep"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 2. In Progress */}
          <div className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-800 font-black text-base">
                  ↗
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  {data.inProgress.length} skills
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900">In Progress</h3>
              <p className="mt-1 text-xs text-slate-500">Actively being studied.</p>

              <div className="mt-4 space-y-3">
                {data.inProgress.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No skills in progress.</p>
                ) : (
                  data.inProgress.map((s) => (
                    <div key={s.slug} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span>{s.name}</span>
                        <span className="text-blue-700">{s.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Remaining Gaps */}
          <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-800 font-black text-base">
                  !
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  {data.remainingGaps.length} gaps
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900">Remaining Gaps</h3>
              <p className="mt-1 text-xs text-slate-500">Ordered by priority impact.</p>

              <div className="mt-4 space-y-2">
                {data.remainingGaps.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">All skill gaps closed!</p>
                ) : (
                  data.remainingGaps.slice(0, 4).map((g) => (
                    <div
                      key={g.slug}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs"
                    >
                      <span className="font-bold text-slate-800">{g.name}</span>
                      <span className="font-semibold text-amber-800">Gap: {g.gap}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4. Next Steps */}
          <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-800 font-black text-base">
                  →
                </span>
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                  {data.nextStepCandidates.length} actions
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900">Next Steps</h3>
              <p className="mt-1 text-xs text-slate-500">Highest-impact candidates.</p>

              <div className="mt-4 space-y-2.5">
                {narrative?.nextSteps.map((step, idx) => {
                  const candidate = data.nextStepCandidates.find(
                    (c) => c.candidateId === step.candidateId
                  );
                  return (
                    <div
                      key={step.candidateId}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 font-black text-violet-900">
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-violet-200 text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{step.text}</span>
                      </div>
                      {candidate && (
                        <div>
                          {candidate.actionType === "start_assessment" && candidate.skillSlug && (
                            <Link
                              href={`/assessment/${candidate.skillSlug}`}
                              className="text-[11px] font-bold text-emerald-700 underline"
                            >
                              Start assessment →
                            </Link>
                          )}
                          {candidate.actionType === "open_skill" && candidate.skillSlug && (
                            <Link
                              href={`/skills/${candidate.skillSlug}`}
                              className="text-[11px] font-bold text-violet-700 underline"
                            >
                              Practice skill →
                            </Link>
                          )}
                          {candidate.actionType === "open_journey" && (
                            <Link
                              href="/journey"
                              className="text-[11px] font-bold text-emerald-700 underline"
                            >
                              Open journey →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional telemetry details: Activity, Assessments, Journey */}
      {data && (
        <div className="grid gap-5 md:grid-cols-3">
          {/* Activity summary */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="text-sm font-black uppercase text-slate-500 tracking-wider">
              Weekly Activity
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <span className="block text-2xl font-black text-emerald-900">
                  {data.activity.completedThisWeek}/{data.activity.totalThisWeek}
                </span>
                <span className="text-xs font-semibold text-emerald-700">This week</span>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <span className="block text-2xl font-black text-slate-800">
                  {data.activity.completedOverall}
                </span>
                <span className="text-xs font-semibold text-slate-500">Total done</span>
              </div>
            </div>
            {data.activity.skippedOverall > 0 && (
              <p className="text-xs text-slate-500">
                {data.activity.skippedOverall} activities skipped overall.
              </p>
            )}
          </div>

          {/* Assessment summary */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="text-sm font-black uppercase text-slate-500 tracking-wider">
              Assessments ({data.assessments.totalCount})
            </h4>
            {data.assessments.lastThree.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No completed assessments yet.</p>
            ) : (
              <div className="space-y-2">
                {data.assessments.lastThree.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs rounded-xl bg-slate-50 p-2.5"
                  >
                    <span className="font-bold text-slate-800">{a.skill}</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {Math.round(a.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Journey info */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="text-sm font-black uppercase text-slate-500 tracking-wider">
              Journey Plan v{data.journey.currentVersion}
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed">
              {data.journey.latestChangeSummary}
            </p>
            {data.struggling.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 font-semibold">
                ⚠️ {data.struggling.length} struggling skill(s) flagged for reinforcement.
              </div>
            )}
            {data.toVerify.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 font-semibold">
                ℹ️ {data.toVerify.length} skill(s) ready for verification assessment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Drawer */}
      {historyReports.length > 1 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-black text-slate-900">Previous Reports</h3>
          <div className="divide-y divide-slate-100">
            {historyReports.slice(1).map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setCurrentReport(rep)}
                className="w-full text-left py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl transition"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {rep.narrative?.headline || "Progress Report"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Generated on {new Date(rep.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700">View report →</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
