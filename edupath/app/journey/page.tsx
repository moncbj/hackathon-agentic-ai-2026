"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type ActivityType = "resource" | "practice" | "project";
export type ActivityState = "planned" | "done" | "skipped";

export interface Activity {
  id: string;
  skill: string;
  skillId?: string;
  type: ActivityType;
  minutes: number;
  title: string;
  mission: string;
  instructions?: string;
  successCriteria: string;
  resource?: { title: string; url: string };
  state: ActivityState;
  readyForAssessment?: boolean;
  skillProgress?: number;
}

export interface Objective {
  id?: string;
  skillId?: string;
  skill: string;
  description: string;
  criteria: string[];
  targetLevel?: number;
}

export interface Week {
  number: number;
  headline: string;
  note: string;
  totalMinutes?: number;
  activities: Activity[];
}

export interface JourneyData {
  objectives: Objective[];
  weeks: Week[];
}

export const journeyFixture: JourneyData = {
  objectives: [
    {
      id: "obj-sql",
      skillId: "skill-sql",
      skill: "SQL",
      description: "Build confidence querying real datasets and explaining your reasoning.",
      criteria: ["Write filtered SELECT queries with joins.", "Summarize a dataset using aggregations."],
    },
    {
      id: "obj-spreadsheets",
      skillId: "skill-spreadsheets",
      skill: "Spreadsheets",
      description: "Use formulas and pivots to turn a raw table into useful answers.",
      criteria: ["Create a pivot table from a raw dataset.", "Explain one insight with a chart."],
    },
  ],
  weeks: [
    {
      number: 1,
      headline: "Find the signal",
      note: "Start small: every completed mission is evidence that you can work with data.",
      activities: [
        {
          id: "sql-resource-1",
          skill: "SQL",
          type: "resource",
          minutes: 45,
          title: "Read a table like a detective",
          mission:
            "Learn how rows, columns and filters turn a table into an answer. Keep a note of one question you would ask this dataset.",
          successCriteria: "Identify the table, the question, and the filter in one query.",
          resource: { title: "SQLBolt: Introduction", url: "https://sqlbolt.com/" },
          state: "planned",
        },
        {
          id: "sql-practice-1",
          skill: "SQL",
          type: "practice",
          minutes: 60,
          title: "Ask three useful questions",
          mission:
            "Use SELECT, WHERE and ORDER BY to investigate a tiny sales dataset. Treat each query as a hypothesis you can check.",
          instructions:
            "Write three queries: filter one segment, sort a result, and count rows. Save the final query for each.",
          successCriteria: "Three queries run and each answers a distinct question.",
          state: "planned",
        },
      ],
    },
    {
      number: 2,
      headline: "Make patterns visible",
      note: "You are moving from raw numbers to a story someone else can act on.",
      activities: [
        {
          id: "sheet-resource-1",
          skill: "Spreadsheets",
          type: "resource",
          minutes: 45,
          title: "Meet the pivot table",
          mission:
            "See how a pivot table groups a messy list into a clear summary. Notice which field belongs in rows and which belongs in values.",
          successCriteria: "Create a pivot table showing a total by category.",
          resource: {
            title: "Google Sheets training",
            url: "https://support.google.com/a/users/answer/9300022",
          },
          state: "planned",
        },
        {
          id: "sheet-project-1",
          skill: "Spreadsheets",
          type: "project",
          minutes: 75,
          title: "Mini project: weekly sales story",
          mission:
            "Turn a simple sales table into one concise insight for a teammate. Choose a chart that makes the comparison easy to see.",
          instructions:
            "Create a pivot, add a chart, and write a two-sentence takeaway below it.",
          successCriteria: "A reader can identify the strongest category and why it matters.",
          state: "planned",
        },
      ],
    },
  ],
};

const typeStyle: Record<ActivityType, string> = {
  resource: "bg-sky-100 text-sky-800 border-sky-200",
  practice: "bg-violet-100 text-violet-800 border-violet-200",
  project: "bg-amber-100 text-amber-800 border-amber-200",
};

interface ApiJourneyResponse {
  journey: {
    id: string;
    version: number;
    summary: string;
  };
  weeks: Array<{
    number: number;
    headline: string;
    note: string;
    totalMinutes: number;
    activities: Array<{
      id: string;
      skillId: string;
      skillName: string;
      skillSlug: string;
      type: ActivityType;
      title: string;
      mission: string;
      instructions: string;
      successCriteria: string;
      minutes: number;
      status: "pending" | "done" | "skipped";
      resource?: {
        title: string;
        url: string;
      } | null;
      skill: {
        progress: number;
        readyForAssessment: boolean;
      };
    }>;
  }>;
  objectives: Array<{
    id: string;
    skillId: string;
    skillName?: string;
    skillSlug?: string;
    description: string;
    criteria: string[];
    targetLevel: number;
  }>;
}

export default function JourneyPage({
  initialJourneyData,
}: {
  initialJourneyData?: JourneyData;
}) {
  const [journey, setJourney] = useState<JourneyData | null>(initialJourneyData ?? null);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(!initialJourneyData);
  const [creating, setCreating] = useState(false);
  const [noJourney, setNoJourney] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialJourneyData) {
      return;
    }

    let active = true;

    fetch("/api/journey")
      .then(async (res) => {
        if (res.status === 404) {
          if (active) {
            setNoJourney(true);
            setLoading(false);
          }
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to load learning journey");
        }

        const data: ApiJourneyResponse = await res.json();
        if (active) {
          const transformed: JourneyData = {
            objectives: data.objectives.map((obj) => ({
              id: obj.id,
              skillId: obj.skillId,
              skill: obj.skillName ?? obj.skillSlug ?? "Skill",
              description: obj.description,
              criteria: obj.criteria,
              targetLevel: obj.targetLevel,
            })),
            weeks: data.weeks.map((w) => ({
              number: w.number,
              headline: w.headline,
              note: w.note,
              totalMinutes: w.totalMinutes,
              activities: w.activities.map((a) => ({
                id: a.id,
                skill: a.skillName || a.skillSlug,
                skillId: a.skillId,
                type: a.type,
                minutes: a.minutes,
                title: a.title,
                mission: a.mission,
                instructions: a.instructions,
                successCriteria: a.successCriteria,
                resource: a.resource ? { title: a.resource.title, url: a.resource.url } : undefined,
                state: a.status === "done" ? "done" : a.status === "skipped" ? "skipped" : "planned",
                readyForAssessment: a.skill?.readyForAssessment,
                skillProgress: a.skill?.progress,
              })),
            })),
          };
          setJourney(transformed);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Error loading journey");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialJourneyData]);

  const currentWeek = useMemo(() => {
    if (!journey || journey.weeks.length === 0) return null;
    return journey.weeks.find((item) => item.number === week) ?? journey.weeks[0];
  }, [journey, week]);

  const completed = useMemo(
    () =>
      journey?.weeks.flatMap((item) => item.activities).filter((a) => a.state === "done").length ??
      0,
    [journey]
  );

  const total = useMemo(
    () => journey?.weeks.flatMap((item) => item.activities).length ?? 0,
    [journey]
  );

  async function handleCreatePlan() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/journey/generate", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to create learning plan");
      }
      const data: ApiJourneyResponse = await res.json();
      const transformed: JourneyData = {
        objectives: data.objectives.map((obj) => ({
          id: obj.id,
          skillId: obj.skillId,
          skill: obj.skillName ?? obj.skillSlug ?? "Skill",
          description: obj.description,
          criteria: obj.criteria,
          targetLevel: obj.targetLevel,
        })),
        weeks: data.weeks.map((w) => ({
          number: w.number,
          headline: w.headline,
          note: w.note,
          totalMinutes: w.totalMinutes,
          activities: w.activities.map((a) => ({
            id: a.id,
            skill: a.skillName || a.skillSlug,
            skillId: a.skillId,
            type: a.type,
            minutes: a.minutes,
            title: a.title,
            mission: a.mission,
            instructions: a.instructions,
            successCriteria: a.successCriteria,
            resource: a.resource ? { title: a.resource.title, url: a.resource.url } : undefined,
            state: a.status === "done" ? "done" : a.status === "skipped" ? "skipped" : "planned",
            readyForAssessment: a.skill?.readyForAssessment,
            skillProgress: a.skill?.progress,
          })),
        })),
      };
      setJourney(transformed);
      setNoJourney(false);
      setWeek(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating journey");
    } finally {
      setCreating(false);
    }
  }

  async function handleCompleteActivity(activityId: string) {
    if (initialJourneyData) {
      // Local state update when using fixture prop
      setJourney((curr) =>
        curr
          ? {
              ...curr,
              weeks: curr.weeks.map((w) => ({
                ...w,
                activities: w.activities.map((a) =>
                  a.id === activityId ? { ...a, state: "done" } : a
                ),
              })),
            }
          : null
      );
      return;
    }

    setActionLoading((prev) => ({ ...prev, [activityId]: true }));
    try {
      const res = await fetch(`/api/activities/${activityId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to mark activity as completed");
      }
      const data = await res.json();
      setJourney((curr) =>
        curr
          ? {
              ...curr,
              weeks: curr.weeks.map((w) => ({
                ...w,
                activities: w.activities.map((a) =>
                  a.id === activityId
                    ? {
                        ...a,
                        state: "done",
                        skillProgress: data.skill?.progress ?? a.skillProgress,
                        readyForAssessment:
                          data.skill?.readyForAssessment ?? a.readyForAssessment,
                      }
                    : a
                ),
              })),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error completing activity");
    } finally {
      setActionLoading((prev) => ({ ...prev, [activityId]: false }));
    }
  }

  async function handleSkipActivity(activityId: string) {
    if (initialJourneyData) {
      // Local state update when using fixture prop
      setJourney((curr) =>
        curr
          ? {
              ...curr,
              weeks: curr.weeks.map((w) => ({
                ...w,
                activities: w.activities.map((a) =>
                  a.id === activityId ? { ...a, state: "skipped" } : a
                ),
              })),
            }
          : null
      );
      return;
    }

    setActionLoading((prev) => ({ ...prev, [activityId]: true }));
    try {
      const res = await fetch(`/api/activities/${activityId}/skip`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to skip activity");
      }
      setJourney((curr) =>
        curr
          ? {
              ...curr,
              weeks: curr.weeks.map((w) => ({
                ...w,
                activities: w.activities.map((a) =>
                  a.id === activityId ? { ...a, state: "skipped" } : a
                ),
              })),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error skipping activity");
    } finally {
      setActionLoading((prev) => ({ ...prev, [activityId]: false }));
    }
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl space-y-7 animate-pulse">
        <div className="h-40 rounded-3xl bg-slate-200" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-4">
            <div className="h-10 w-64 rounded bg-slate-200" />
            <div className="h-32 rounded-2xl bg-slate-200" />
            <div className="h-48 rounded-2xl bg-slate-200" />
          </div>
          <div className="h-96 rounded-2xl bg-slate-200" />
        </div>
      </section>
    );
  }

  if (noJourney) {
    return (
      <section className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-10 text-center shadow-md space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Your Learning Plan is Ready to Create</h1>
          <p className="mt-2 text-slate-600">
            Based on your role target and current skills, we will construct a personalized weekly plan of missions, curated resources, and practical projects.
          </p>
        </div>
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div>
          <button
            onClick={handleCreatePlan}
            disabled={creating}
            className="rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Generating your journey..." : "Create my plan"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Or return to <Link href="/dashboard" className="text-emerald-700 font-semibold underline">Dashboard</Link>
        </p>
      </section>
    );
  }

  if (!journey) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">We couldn&apos;t load your learning journey</h2>
        <p className="text-sm text-slate-600">{error ?? "Please verify your profile or try again."}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-7">
      <header className="rounded-3xl bg-gradient-to-br from-emerald-800 to-teal-700 p-7 text-white shadow-lg">
        <p className="text-sm font-bold uppercase tracking-widest text-emerald-100">
          Learning journey
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Your next missions</h1>
            <p className="mt-1 text-emerald-50">
              A focused roadmap built around your highest-impact skills.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-right">
            <span className="block text-2xl font-black">
              {completed}/{total}
            </span>
            <span className="text-xs font-semibold">missions complete</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-rose-700">✕</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <main className="space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Journey weeks">
            {journey.weeks.map((item) => (
              <button
                key={item.number}
                role="tab"
                aria-selected={week === item.number}
                onClick={() => setWeek(item.number)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                  week === item.number
                    ? "bg-emerald-700 text-white shadow"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50"
                }`}
              >
                Week {item.number}
              </button>
            ))}
          </div>

          {currentWeek && (
            <>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <h2 className="text-xl font-black text-emerald-950">{currentWeek.headline}</h2>
                <p className="mt-1 text-sm text-emerald-900">{currentWeek.note}</p>
              </div>

              <div className="space-y-4">
                {currentWeek.activities.map((activity) => (
                  <article
                    key={activity.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                      activity.state === "done"
                        ? "border-emerald-200 opacity-60 bg-emerald-50/20"
                        : activity.state === "skipped"
                        ? "border-slate-300 opacity-55 bg-slate-50/50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                              typeStyle[activity.type]
                            }`}
                          >
                            {activity.type}
                          </span>
                          {activity.readyForAssessment && (
                            <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              Ready for assessment
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-900">
                          {activity.title}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {activity.skill} · {activity.minutes} min
                          {activity.skillProgress !== undefined && (
                            <span className="ml-2 text-xs font-medium text-emerald-700">
                              (Skill progress: {activity.skillProgress}%)
                            </span>
                          )}
                        </p>
                      </div>

                      {activity.state === "done" && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                          ✓ Completed
                        </span>
                      )}
                      {activity.state === "skipped" && (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                          Skipped
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-slate-700">{activity.mission}</p>

                    {activity.instructions && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        <strong>Mission steps:</strong> {activity.instructions}
                      </div>
                    )}

                    <p className="mt-3 text-sm text-slate-700">
                      <strong>Success looks like:</strong> {activity.successCriteria}
                    </p>

                    {activity.resource && (
                      <a
                        className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 underline underline-offset-4 hover:text-emerald-900"
                        href={activity.resource.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open resource: {activity.resource.title}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}

                    <div className="mt-5 flex gap-3">
                      <button
                        disabled={activity.state === "done" || actionLoading[activity.id]}
                        onClick={() => handleCompleteActivity(activity.id)}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 transition"
                      >
                        {actionLoading[activity.id] ? "Updating..." : "Done"}
                      </button>
                      <button
                        disabled={activity.state !== "planned" || actionLoading[activity.id]}
                        onClick={() => handleSkipActivity(activity.id)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition"
                      >
                        Skip
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </main>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Objectives</h2>
            <div className="mt-4 space-y-5">
              {journey.objectives.map((objective) => (
                <div key={objective.id ?? objective.skillId ?? objective.skill} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-emerald-800">{objective.skill}</h3>
                    {objective.targetLevel !== undefined && (
                      <span className="text-xs font-semibold text-slate-500">
                        Target L{objective.targetLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">{objective.description}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {objective.criteria.map((criterion) => (
                      <li key={criterion} className="flex gap-2">
                        <span className="text-emerald-600">✓</span>
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
