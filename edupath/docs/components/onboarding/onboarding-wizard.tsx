"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { StepGoal } from "@/components/onboarding/step-goal";
import { StepSkills } from "@/components/onboarding/step-skills";
import { StepStyle } from "@/components/onboarding/step-style";
import { Stepper } from "@/components/onboarding/stepper";
import { fetchRoles, submitOnboarding } from "@/app/_lib/api/onboarding";
import type { Role, TutorStyle } from "@/app/_lib/api/onboarding-types";
import {
    INITIAL_VALUES,
    buildOnboardingRequest,
    validateStep,
    type FormErrors,
    type OnboardingFormValues,
} from "@/app/onboarding/validation";

const STEPS = ["Goal", "Skills", "Tutor style"] as const;

type SubmitState =
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "conflict" }
    | { status: "error"; kind: "network" | "server" };

type RolesState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; roles: Role[] };

export function OnboardingWizard() {
    const router = useRouter();
    const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
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
        // Editing a field clears its own inline errors.
        setErrors((current) => {
            const next = { ...current };
            for (const field of Object.keys(patch)) {
                if (field === "extraSkills") continue; // handled below, row by row
                for (const key of Object.keys(next)) {
                    if (key === field || key.startsWith(`${field}.`)) delete next[key];
                }
            }
            if (patch.tutorStyle) {
                for (const field of Object.keys(patch.tutorStyle) as Array<keyof TutorStyle>) {
                    if (patch.tutorStyle[field] !== values.tutorStyle[field]) delete next[field];
                }
            }
            if (patch.extraSkills) {
                // Only clear the errors of the rows that changed. If rows were added or removed, indexes shift, so clear them all.
                const before = values.extraSkills;
                const after = patch.extraSkills;
                for (const key of Object.keys(next)) {
                    if (key === "extraSkills") delete next[key];
                    else if (key.startsWith("extraSkills.")) {
                        const index = Number(key.split(".")[1]);
                        const changed =
                            before.length !== after.length ||
                            before[index]?.name !== after[index]?.name ||
                            before[index]?.level !== after[index]?.level;
                        if (changed) delete next[key];
                    }
                }
            }
            return next;
        });
        if (submitState.status === "error" || submitState.status === "conflict") {
            setSubmitState({ status: "idle" });
        }
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

    async function handleSubmit(role: Role) {
        // Validate every step so nothing invalid reaches the API, and jump to the first step with problems.
        for (let index = 0; index < STEPS.length; index += 1) {
            const stepErrors = validateStep(index, values);
            if (Object.keys(stepErrors).length > 0) {
                setErrors(stepErrors);
                setStep(index);
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }
        }
        setErrors({});
        setSubmitState({ status: "submitting" });

        const request = buildOnboardingRequest(
            values,
            role.skills.map((skill) => skill.slug),
        );
        const { data, error } = await submitOnboarding(request);

        if (error || !data) {
            if (error?.status === 409) setSubmitState({ status: "conflict" });
            else setSubmitState({ status: "error", kind: error?.type === "network" ? "network" : "server" });
            return;
        }

        // Stay in the "submitting" state while the browser navigates, so the form can't be sent twice.
        router.push("/dashboard");
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

    const role = rolesState.roles.find((candidate) => candidate.slug === values.targetRoleSlug);
    const hasErrors = Object.keys(errors).length > 0;
    const isLastStep = step === STEPS.length - 1;
    const isSubmitting = submitState.status === "submitting";

    return (
        <Card>
            <CardContent className="space-y-6">
                <Stepper steps={STEPS} current={step} />

                <form
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (isSubmitting) return;
                        if (isLastStep && role) void handleSubmit(role);
                        else handleNext();
                    }}
                >
                    {/* A disabled fieldset locks every control (and both buttons) while the profile is being created. */}
                    <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
                        {hasErrors && (
                            <Alert variant="error" title="Please fix the highlighted fields">
                                Some answers need a change before you can continue.
                            </Alert>
                        )}

                        {step === 0 && (
                            <StepGoal values={values} errors={errors} roles={rolesState.roles} onChange={handleChange} />
                        )}

                        {step === 1 && role && (
                            <StepSkills values={values} errors={errors} role={role} onChange={handleChange} />
                        )}

                        {step === 2 && <StepStyle values={values} errors={errors} onChange={handleChange} />}

                        {isLastStep && submitState.status === "conflict" && (
                            <Alert variant="warning" title="You already have a profile">
                                <p>A profile already exists, so we can&apos;t create another one. Continue with the one you have.</p>
                                <Button type="button" size="sm" className="mt-3" onClick={() => router.push("/dashboard")}>
                                    Go to my dashboard
                                </Button>
                            </Alert>
                        )}

                        {isLastStep && submitState.status === "error" && (
                            <Alert variant="error" title="We couldn't create your profile">
                                {submitState.kind === "network"
                                    ? "We couldn't reach the server. Check your connection and try again. Your answers are still here."
                                    : "Something went wrong on our side. Your answers are still here, so you can try again."}
                            </Alert>
                        )}

                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                            <Button type="button" variant="secondary" onClick={handleBack} disabled={step === 0}>
                                Back
                            </Button>
                            {isLastStep ? (
                                <Button type="submit">
                                    {isSubmitting ? (
                                        "Creating your profile..."
                                    ) : submitState.status === "error" ? (
                                        "Try again"
                                    ) : (
                                        "Create my profile"
                                    )}
                                </Button>
                            ) : (
                                <Button type="submit">Next</Button>
                            )}
                        </div>
                    </fieldset>
                </form>
            </CardContent>
        </Card>
    );
}
