"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Status = "locked" | "available" | "in_progress" | "acquired" | "struggling";
type TreeNode = {
  id: string;
  slug: string;
  name: string;
  level: number;
  requiredLevel: number;
  gap: number;
  verification: "self_reported" | "verified";
  status: Status;
  needsVerification: boolean;
  depth: number;
  progress?: number;
};
type Tree = { nodes: TreeNode[]; edges: { source: string; target: string }[] };
type Gaps = {
  summary: { acquired: number; withGap: number };
  topPriorities: { skillSlug: string; name: string; gap: number; priority: number }[];
  unverified: { skillSlug: string; name: string; level: number }[];
  agentExplanation: {
    summary: string;
    perSkill: { skillSlug: string; explanation: string; whyItMatters: string }[];
  } | null;
};

interface JourneyActivity {
  id: string;
  skillName: string;
  skillSlug: string;
  type: "resource" | "practice" | "project";
  title: string;
  minutes: number;
  status: "pending" | "done" | "skipped";
}

interface JourneyWeek {
  number: number;
  headline: string;
  note: string;
  totalMinutes: number;
  activities: JourneyActivity[];
}

interface JourneyChangeItem {
  type: string;
  skillSlug: string;
  detail: string;
}

interface JourneySummary {
  journey: {
    id: string;
    version: number;
    summary: string;
    changes?: {
      items?: JourneyChangeItem[];
      explanation?: string;
    } | null;
  };
  weeks: JourneyWeek[];
  stats: {
    totalActivities: number;
    completedActivities: number;
    skippedActivities: number;
  };
}

const statusStyle: Record<Status, string> = {
  locked: "border-slate-300 bg-slate-100 text-slate-500 opacity-65",
  available: "border-sky-300 bg-sky-50 text-sky-950",
  in_progress: "border-amber-400 bg-amber-50 text-amber-950",
  acquired: "border-emerald-400 bg-emerald-50 text-emerald-950",
  struggling: "border-rose-400 bg-rose-50 text-rose-950",
};

const activityTypeBadge: Record<string, string> = {
  resource: "bg-sky-100 text-sky-800 border-sky-200",
  practice: "bg-violet-100 text-violet-800 border-violet-200",
  project: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function DashboardPage() {
  const router = useRouter();
  const [tree, setTree] = useState<Tree | null>(null);
  const [gaps, setGaps] = useState<Gaps | null>(null);
  const [journey, setJourney] = useState<JourneySummary | null>(null);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [generatingJourney, setGeneratingJourney] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [treeResponse, gapsResponse, journeyResponse] = await Promise.all([
          fetch("/api/skill-tree"),
          fetch("/api/gaps"),
          fetch("/api/journey"),
        ]);

        if (treeResponse.status === 404 || gapsResponse.status === 404) {
          router.push("/onboarding");
          return;
        }

        if (!treeResponse.ok || !gapsResponse.ok) {
          throw new Error("Dashboard request failed");
        }

        const [nextTree, nextGaps] = await Promise.all([
          treeResponse.json() as Promise<Tree>,
          gapsResponse.json() as Promise<Gaps>,
        ]);

        let nextJourney: JourneySummary | null = null;
        if (journeyResponse.ok) {
          nextJourney = await journeyResponse.json();
        }

        if (active) {
          setTree(nextTree);
          setGaps(nextGaps);
          setJourney(nextJourney);
        }
      } catch {
        if (active) {
          setError(true);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [retry, router]);

  const columns = useMemo(() => {
    const result = new Map<number, TreeNode[]>();
    for (const node of tree?.nodes ?? []) {
      result.set(node.depth, [...(result.get(node.depth) ?? []), node]);
    }
    return [...result.entries()].sort(([a], [b]) => a - b);
  }, [tree]);

  const currentWeek = useMemo(() => {
    if (!journey || journey.weeks.length === 0) return null;
    // Current week is the first week with incomplete activities, or week 1
    const incompleteWeek = journey.weeks.find((w) =>
      w.activities.some((a) => a.status === "pending")
    );
    return incompleteWeek ?? journey.weeks[0];
  }, [journey]);

  const currentWeekCompleted = useMemo(() => {
    if (!currentWeek) return 0;
    return currentWeek.activities.filter((a) => a.status === "done").length;
  }, [currentWeek]);

  async function handleCreateJourney() {
    setGeneratingJourney(true);
    setJourneyError(null);
    try {
      const res = await fetch("/api/journey/generate", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to create learning plan");
      }
      const data: JourneySummary = await res.json();
      setJourney(data);
    } catch (err) {
      setJourneyError(err instanceof Error ? err.message : "Error creating journey");
    } finally {
      setGeneratingJourney(false);
    }
  }

  const prerequisites = selected
    ? tree?.edges
        .filter((edge) => edge.target === selected.id)
        .map((edge) => tree.nodes.find((node) => node.id === edge.source)?.name)
        .filter(Boolean) ?? []
    : [];

  const explanation =
    selected &&
    gaps?.agentExplanation?.perSkill.find((item) => item.skillSlug === selected.slug);

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold">We couldn’t load your learning map</h2>
        <button
          className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
          onClick={() => {
            setError(false);
            setRetry((value) => value + 1);
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!tree || !gaps) {
    return (
      <section className="animate-pulse space-y-5">
        <div className="h-8 w-64 rounded bg-slate-200" />
        <div className="h-44 rounded-2xl bg-slate-200" />
        <div className="h-96 rounded-2xl bg-slate-200" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Plan Changes Panel (SPEC-004) */}
      {journey?.journey?.changes?.items && journey.journey.changes.items.length > 0 && (
        <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 border border-indigo-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-800">
                Journey v{journey.journey.version}
              </span>
              <span className="text-xs font-bold text-indigo-700">Cambios recientes en tu plan</span>
            </div>
          </div>
          <h3 className="mt-2 text-xl font-black text-slate-900">Adaptación inteligente del plan</h3>
          {journey.journey.changes.explanation && (
            <p className="mt-1 text-sm text-slate-700 leading-relaxed max-w-3xl">
              {journey.journey.changes.explanation}
            </p>
          )}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {journey.journey.changes.items.map((change, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-indigo-100 text-xs shadow-xs"
              >
                <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 mt-0.5">
                  {change.type.replace(/_/g, " ")}
                </span>
                <span className="text-slate-800 leading-snug">{change.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. "This week" or "Create plan" widget (SPEC-003) */}
      {journey && currentWeek ? (
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-900 to-teal-800 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-100">
                  This Week · Week {currentWeek.number} (v{journey.journey.version})
                </span>
                <span className="text-xs text-emerald-200">
                  {currentWeekCompleted} of {currentWeek.activities.length} completed
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-black">{currentWeek.headline}</h2>
              <p className="mt-1 text-sm text-emerald-100/90">{currentWeek.note}</p>
            </div>

            <Link
              href="/journey"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-900 shadow hover:bg-emerald-50 transition"
            >
              Go to journey →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currentWeek.activities.map((act) => (
              <div
                key={act.id}
                className={`rounded-2xl border p-4 text-slate-900 transition ${
                  act.status === "done"
                    ? "border-emerald-200/50 bg-emerald-50/80 opacity-70"
                    : act.status === "skipped"
                    ? "border-slate-300 bg-slate-100 opacity-60"
                    : "border-white/20 bg-white shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      activityTypeBadge[act.type]
                    }`}
                  >
                    {act.type}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{act.minutes} min</span>
                </div>
                <h4 className="mt-2 font-bold text-sm line-clamp-1">{act.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{act.skillName}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  {act.status === "done" && (
                    <span className="font-bold text-emerald-700">✓ Done</span>
                  )}
                  {act.status === "skipped" && (
                    <span className="font-semibold text-slate-500">Skipped</span>
                  )}
                  {act.status === "pending" && (
                    <span className="font-semibold text-amber-700">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-xl">
              <span className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
                Personalized Learning Plan
              </span>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                Turn your gaps into a weekly plan of missions
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Generate your personalized roadmap with curated resources, practical exercises, and projects tailored to your target role.
              </p>
              {journeyError && (
                <p className="mt-2 text-xs font-semibold text-rose-700">{journeyError}</p>
              )}
            </div>

            <button
              onClick={handleCreateJourney}
              disabled={generatingJourney}
              className="rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white shadow hover:bg-emerald-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingJourney ? "Creating your plan..." : "Create my plan"}
            </button>
          </div>
        </section>
      )}

      {/* 2. Skill Tree Header */}
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          Your learning map
        </p>
        <h2 className="text-3xl font-black tracking-tight">Skill tree</h2>
        <p className="mt-1 text-slate-600">
          {gaps.agentExplanation?.summary ??
            `${gaps.summary.withGap} skills need attention and ${gaps.summary.acquired} meet their target level.`}
        </p>
      </header>

      {/* 3. Skill Tree Grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap gap-3 text-xs font-semibold">
            {Object.keys(statusStyle).map((status) => (
              <span
                key={status}
                className={`rounded-full border px-2 py-1 ${statusStyle[status as Status]}`}
              >
                {status.replace("_", " ")}
              </span>
            ))}
            <span className="rounded-full border border-dashed border-slate-400 px-2 py-1">
              self-reported
            </span>
            <span className="rounded-full border border-emerald-500 px-2 py-1">verified</span>
          </div>

          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-max items-start gap-6">
              {columns.map(([depth, nodes]) => (
                <div key={depth} className="w-52 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Foundation {depth + 1}
                  </p>
                  {nodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => setSelected(node)}
                      className={`w-full rounded-xl border-2 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                        statusStyle[node.status]
                      } ${node.verification === "self_reported" ? "border-dashed" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold">{node.name}</span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.2 rounded ${
                            node.verification === "verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : "text-slate-400"
                          }`}
                        >
                          {node.verification === "verified" ? "✓ Verified" : "○ Self"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs">
                        Level {node.level}/{node.requiredLevel} · {node.status.replace("_", " ")}
                        {node.status === "struggling" && (
                          <span className="block text-rose-700 font-bold text-[11px] mt-0.5">
                            ⚠️ Prioridad de refuerzo
                          </span>
                        )}
                        {node.progress !== undefined && node.progress > 0 && (
                          <span className="block text-emerald-800 font-semibold mt-0.5">
                            {node.progress}% progress
                          </span>
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Priorities & Unverified Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-bold">Top priorities</h3>
            <ol className="mt-3 space-y-3">
              {gaps.topPriorities.map((item) => (
                <li key={item.skillSlug} className="flex justify-between gap-3 text-sm">
                  <span>{item.name}</span>
                  <span className="font-bold text-rose-700">Gap {item.gap}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-bold">Unverified skills</h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              {gaps.unverified.length ? (
                gaps.unverified.map((item) => (
                  <li key={item.skillSlug} className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{item.name}</span>{" "}
                      <span className="text-slate-400 text-xs">(Lvl {item.level})</span>
                    </div>
                    <Link
                      href={`/assessment/${item.skillSlug}`}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition"
                    >
                      Evaluate
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">Nothing to verify yet.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      {/* 5. Selected Skill Detail */}
      {selected && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-emerald-700">Skill detail</span>
                {selected.verification === "verified" ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Self-reported
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-black">{selected.name}</h3>
              <p className="mt-1 text-slate-600">
                Level {selected.level} of {selected.requiredLevel} · Gap {selected.gap} ·{" "}
                <span className="capitalize">{selected.status.replace("_", " ")}</span>
                {selected.progress !== undefined && (
                  <span className="ml-2 font-semibold text-emerald-800">
                    · {selected.progress}% progress
                  </span>
                )}
              </p>
            </div>
            {selected.progress !== undefined && selected.progress >= 100 ? (
              <Link
                href={`/assessment/${selected.slug}`}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-bold text-white shadow-sm transition inline-flex items-center gap-1.5"
              >
                Ready for assessment →
              </Link>
            ) : selected.verification === "self_reported" && selected.level >= 1 ? (
              <Link
                href={`/assessment/${selected.slug}`}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 font-bold text-white shadow-sm transition inline-flex items-center gap-1.5"
              >
                Evaluate skill →
              </Link>
            ) : (
              <button
                disabled
                title="Skill must have self-reported level >= 1 or progress >= 100% to evaluate"
                className="cursor-not-allowed rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400 border border-slate-200"
              >
                Ineligible to assess
              </button>
            )}
          </div>
          {prerequisites.length > 0 && (
            <p className="mt-4 text-sm">
              <strong>Prerequisites:</strong> {prerequisites.join(", ")}
            </p>
          )}
          {explanation && (
            <div className="mt-4 space-y-2 text-sm">
              <p>{explanation.explanation}</p>
              <p className="text-slate-600">
                <strong>Why it matters:</strong> {explanation.whyItMatters}
              </p>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
