"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { LearnerGate } from "@/components/session/learner-gate";

/** Temporary /dashboard until SPEC-002 (skill tree and gaps) is built. */
export function DashboardPlaceholder() {
    return (
        <LearnerGate>
            {(learner) => (
                <section className="mx-auto max-w-3xl space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome, {learner.name}</h2>
                        <p className="mt-1 text-slate-600">Your profile is ready.</p>
                    </div>
                    <EmptyState
                        title="Your skill tree is on its way"
                        description="Your skills and gaps will show up here as soon as the dashboard is ready."
                    />
                </section>
            )}
        </LearnerGate>
    );
}
