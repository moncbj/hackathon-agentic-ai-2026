"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { IconAlertTriangle, IconCheckCircle, IconInfo } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { fetchHealth } from "@/app/_lib/api/health";
import type { ApiError, HealthResponse } from "@/app/_lib/api/types";

type HealthState =
    | { status: "loading" }
    | { status: "error"; error: ApiError }
    | { status: "loaded"; health: HealthResponse };

const ERROR_DESCRIPTIONS: Record<ApiError["type"], string> = {
    network: "We couldn't reach the server. Check your connection and try again.",
    http: "The server responded with an error. Please try again in a moment.",
    parse: "The server sent a response we couldn't read. Please try again.",
    unknown: "An unexpected error occurred. Please try again.",
};

type PillTone = "ok" | "info" | "error";

const PILL_STYLES: Record<PillTone, string> = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    error: "bg-rose-50 text-rose-800 border-rose-200",
};

const PILL_ICONS = {
    ok: IconCheckCircle,
    info: IconInfo,
    error: IconAlertTriangle,
};

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
    const Icon = PILL_ICONS[tone];
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${PILL_STYLES[tone]}`}
        >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
}

function StatusCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardContent className="space-y-3">
                <p className="text-sm font-medium text-slate-500">{title}</p>
                {children}
            </CardContent>
        </Card>
    );
}

function HealthDetails({ health }: { health: HealthResponse }) {
    const dbTone: PillTone = health.db === "ok" ? "ok" : "error";
    const aiTone: PillTone =
        health.ai === "ok" ? "ok" : health.ai === "fixtures" ? "info" : "error";
    const aiLabel =
        health.ai === "ok"
            ? "Connected"
            : health.ai === "fixtures"
                ? "Demo data mode"
                : "Unavailable";

    return (
        <div className="space-y-4">
            {health.db === "error" && (
                <Alert variant="error" title="Database unavailable">
                    Some features may not work until the connection is restored.
                </Alert>
            )}
            {health.ai === "error" && (
                <Alert variant="warning" title="AI service unavailable">
                    Personalized content may not load right now.
                </Alert>
            )}
            {health.ai === "fixtures" && (
                <Alert variant="info" title="Demo data mode">
                    AI responses come from pre-recorded demo data.
                </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatusCard title="Database">
                    <StatusPill
                        tone={dbTone}
                        label={health.db === "ok" ? "Connected" : "Unavailable"}
                    />
                </StatusCard>
                <StatusCard title="AI service">
                    <StatusPill tone={aiTone} label={aiLabel} />
                </StatusCard>
                <StatusCard title="Roles">
                    <p className="text-3xl font-bold text-slate-900">
                        {health.seededRoles}
                        <span className="ml-2 text-base font-medium text-slate-500">
                            {health.seededRoles === 1 ? "role loaded" : "roles loaded"}
                        </span>
                    </p>
                </StatusCard>
            </div>
        </div>
    );
}

export function HealthStatus() {
    const [state, setState] = useState<HealthState>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;

        fetchHealth().then(({ data, error }) => {
            if (cancelled) return;
            if (error || !data) {
                setState({
                    status: "error",
                    error: error ?? { type: "unknown", message: "No data received." },
                });
                return;
            }
            setState({ status: "loaded", health: data });
        });

        return () => {
            cancelled = true;
        };
    }, [attempt]);

    function handleRetry() {
        setState({ status: "loading" });
        setAttempt((current) => current + 1);
    }

    if (state.status === "loading") {
        return (
            <div
                className="flex items-center justify-center gap-3 py-12 text-slate-600"
                aria-live="polite"
            >
                <Spinner />
                <span>Checking system status...</span>
            </div>
        );
    }

    if (state.status === "error") {
        return (
            <ErrorState
                title="Can't check system status"
                description={ERROR_DESCRIPTIONS[state.error.type]}
                onRetry={handleRetry}
            />
        );
    }

    const { health } = state;
    const hasProblem = health.db === "error" || health.ai === "error";

    if (!hasProblem && health.seededRoles === 0) {
        return (
            <EmptyState
                title="No roles loaded yet"
                description="The system is up, but there are no learning roles to show. Once they are loaded they will appear here."
            />
        );
    }

    return <HealthDetails health={health} />;
}