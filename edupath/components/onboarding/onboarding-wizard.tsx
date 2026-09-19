"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { StepGoal } from "@/components/onboarding/step-goal";
import { Stepper } from "@/components/onboarding/stepper";
import { fetchRoles } from "@/app/_lib/api/onboarding";
import type { Role } from "@/app/_lib/api/onboarding-types";
import {
    INITIAL_VALUES,
    validateStep,
    type FormErrors,
    type OnboardingFormValues,
} from "@/app/onboarding/validation";

const STEPS = ["Goal", "Skills", "Tutor style"] as const;

type RolesState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; roles: Role[] };

export function OnboardingWizard() {
    const [rolesState, setRolesState] = useState<RolesState>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);
    const [step, setStep] = useState(0);
    const [values, setValues] = useState<OnboardingFormValues>(INITIAL_VALUES);
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        let cancelled = false;

        fetchRoles().then(({ data, error }) => {
            if (cancelled) return;
            if (error || !data) {
                setRolesState({ status: "error" });
                return;
            }
            setRolesState({ status: "ready", roles: data.roles });
            // With a single role there is nothing to choose: preselect it.
            if (data.roles.length === 1) {
                const onlyRole = data.roles[0];
                setValues((current) => (current.targetRoleSlug ? current : { ...current, targetRoleSlug: onlyRole.slug }));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [attempt]);

    function handleRetryRoles() {
        setRolesState({ status: "loading" });
        setAttempt((current) => current + 1);
    }

    function handleChange(patch: Partial<OnboardingFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
        // Editing a field clears its own inline error.
        setErrors((current) => {
            const next = { ...current };
            for (const key of Object.keys(patch)) delete next[key];
            return next;
        });
    }

    function handleNext() {
        const stepErrors = validateStep(step, values);
        if (Object.keys(stepErrors).length > 0) {
            setErrors(stepErrors);
            return;
        }
        setErrors({});
        setStep((current) => Math.min(current + 1, STEPS.length - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleBack() {
        setErrors({});
        setStep((current) => Math.max(current - 1, 0));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (rolesState.status === "loading") {
        return (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-600" aria-live="polite">
                <Spinner />
                <span>Loading your options...</span>
            </div>
        );
    }

    if (rolesState.status === "error") {
        return (
            <ErrorState
                title="Can't load the setup form"
                description="We couldn't load the available roles. Please try again."
                onRetry={handleRetryRoles}
            />
        );
    }

    if (rolesState.roles.length === 0) {
        return (
            <EmptyState
                title="No roles available yet"
                description="There are no target roles to choose from right now. Please check back soon."
            />
        );
    }

    const hasErrors = Object.keys(errors).length > 0;
    const isLastStep = step === STEPS.length - 1;

    return (
        <Card>
            <CardContent className="space-y-6">
                <Stepper steps={STEPS} current={step} />

                <form
                    noValidate
                    className="space-y-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        handleNext();
                    }}
                >
                    {hasErrors && (
                        <Alert variant="error" title="Please fix the highlighted fields">
                            Some answers need a change before you can continue.
                        </Alert>
                    )}

                    {step === 0 && (
                        <StepGoal values={values} errors={errors} roles={rolesState.roles} onChange={handleChange} />
                    )}

                    {step > 0 && (
                        <Alert variant="info" title={`${STEPS[step]} step coming next`}>
                            This step is built in the next commit.
                        </Alert>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <Button type="button" variant="secondary" onClick={handleBack} disabled={step === 0}>
                            Back
                        </Button>
                        {!isLastStep && <Button type="submit">Next</Button>}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}