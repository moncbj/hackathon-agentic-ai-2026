"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { fetchLearner, isNoLearnerError } from "@/app/_lib/api/onboarding";
import type { Learner } from "@/app/_lib/api/onboarding-types";

interface LearnerGateProps {
    /** Rendered once we know a learner exists. Can be a function to receive the learner. */
    children?: ReactNode | ((learner: Learner) => ReactNode);
    /** When set, a person who already has a profile is sent to this path instead of seeing the children. */
    redirectIfLearnerTo?: string;
}

type GateState = { status: "loading" } | { status: "error" } | { status: "ready"; learner: Learner };

/**
 * Decides where a person belongs, based on GET /api/learner:
 * no learner (404) means onboarding; a learner means the page (or the redirect target).
 */
export function LearnerGate({ children, redirectIfLearnerTo }: LearnerGateProps) {
    const router = useRouter();
    const [state, setState] = useState<GateState>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;

        fetchLearner().then(({ data, error }) => {
            if (cancelled) return;

            if (isNoLearnerError(error)) {
                // Keep showing the loading state while the redirect happens.
                router.replace("/onboarding");
                return;
            }
            if (error || !data) {
                setState({ status: "error" });
                return;
            }
            if (redirectIfLearnerTo) {
                router.replace(redirectIfLearnerTo);
                return;
            }
            setState({ status: "ready", learner: data });
        });

        return () => {
            cancelled = true;
        };
    }, [attempt, router, redirectIfLearnerTo]);

    function handleRetry() {
        setState({ status: "loading" });
        setAttempt((current) => current + 1);
    }

    if (state.status === "error") {
        return (
            <ErrorState
                title="Can't load your profile"
                description="We couldn't check your profile. Please try again."
                onRetry={handleRetry}
            />
        );
    }

    if (state.status === "loading") {
        return (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-600" aria-live="polite">
                <Spinner />
                <span>Loading your profile...</span>
            </div>
        );
    }

    return <>{typeof children === "function" ? children(state.learner) : children}</>;
}
