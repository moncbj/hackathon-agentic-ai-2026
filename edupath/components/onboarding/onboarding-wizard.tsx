"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { StepGoal } from "@/components/onboarding/step-goal";
import { StepSkills } from "@/components/onboarding/step-skills";
import { StepTutorStyle } from "@/components/onboarding/step-tutor-style";
import { Stepper } from "@/components/onboarding/stepper";
import { fetchRoles, submitOnboarding } from "@/app/_lib/api/onboarding";
import type { Learner, Role } from "@/app/_lib/api/onboarding-types";
import {
    INITIAL_VALUES,
    buildOnboardingRequest,
    validateStep,
    type FormErrors,
    type OnboardingFormValues,
} from "@/app/onboarding/validation";

const STEPS = ["Goal", "Skills", "Tutor style"] as const;

type RolesState =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; roles: Role[] };

export interface OnboardingWizardProps {
    initialStep?: number;
    initialValues?: OnboardingFormValues;
    initialRoles?: Role[];
    initialIsSubmitting?: boolean;
    initialSubmitError?: string | null;
    onSuccess?: (learner: Learner) => void;
    destination?: string;
}

export interface SubmitOnboardingParams {
    values: OnboardingFormValues;
    targetRole?: Role;
    onSuccess?: (learner: Learner) => void;
    destination?: string;
    submitFn?: typeof submitOnboarding;
}

export interface SubmitOnboardingResult {
    success: boolean;
    data?: Learner;
    error?: string;
}

export async function executeOnboardingSubmit({
    values,
    targetRole,
    onSuccess,
    destination = "/dashboard",
    submitFn = submitOnboarding,
}: SubmitOnboardingParams): Promise<SubmitOnboardingResult> {
    // Validate tutor style (step 2)
    const tutorErrors = validateStep(2, values);
    if (Object.keys(tutorErrors).length > 0) {
        return { success: false, error: Object.values(tutorErrors)[0] };
    }

    // Validate goal (step 0)
    const goalErrors = validateStep(0, values);
    if (Object.keys(goalErrors).length > 0) {
        return { success: false, error: Object.values(goalErrors)[0] };
    }

    // Validate skills (step 1)
    const skillsErrors = validateStep(1, values);
    if (Object.keys(skillsErrors).length > 0) {
        return { success: false, error: Object.values(skillsErrors)[0] };
    }

    const roleSkillSlugs = targetRole?.skills.map((s) => s.slug) ?? [];
    const payload = buildOnboardingRequest(values, roleSkillSlugs);

    try {
        const result = await submitFn(payload);
        if (result.error || !result.data) {
            return {
                success: false,
                error: result.error?.message || "We couldn't save your profile. Please try again.",
            };
        }

        if (onSuccess) {
            onSuccess(result.data);
        } else if (typeof window !== "undefined" && window.location?.assign) {
            window.location.assign(destination);
        }

        return { success: true, data: result.data };
    } catch {
        return {
            success: false,
            error: "An unexpected error occurred while saving your profile. Please try again.",
        };
    }
}

export function OnboardingWizard(props: OnboardingWizardProps = {}) {
    const {
        initialStep = 0,
        initialValues = INITIAL_VALUES,
        initialRoles,
        initialIsSubmitting = false,
        initialSubmitError = null,
        onSuccess,
        destination = "/dashboard",
    } = props;
    const [rolesState, setRolesState] = useState<RolesState>(
        initialRoles ? { status: "ready", roles: initialRoles } : { status: "loading" }
    );
    const [attempt, setAttempt] = useState(0);
    const [step, setStep] = useState(initialStep);
    const [values, setValues] = useState<OnboardingFormValues>(initialValues);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(initialIsSubmitting);
    const [submitError, setSubmitError] = useState<string | null>(initialSubmitError);

    useEffect(() => {
        if (initialRoles) return;
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
                setValues((current) => (current.targetRoleId ? current : { ...current, targetRoleId: onlyRole.id }));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [attempt, initialRoles]);

    function handleRetryRoles() {
        setRolesState({ status: "loading" });
        setAttempt((current) => current + 1);
    }

    function handleChange(patch: Partial<OnboardingFormValues>) {
        setValues((current) => ({ ...current, ...patch }));
        setSubmitError(null);
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
        setSubmitError(null);
        setStep((current) => Math.min(current + 1, STEPS.length - 1));
        if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    function handleBack() {
        if (isSubmitting) return;
        setErrors({});
        setSubmitError(null);
        setStep((current) => Math.max(current - 1, 0));
        if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    async function handleSubmit() {
        if (isSubmitting) return;

        const stepErrors = validateStep(step, values);
        if (Object.keys(stepErrors).length > 0) {
            setErrors(stepErrors);
            return;
        }

        setErrors({});
        setSubmitError(null);
        setIsSubmitting(true);

        const targetRole = rolesState.status === "ready"
            ? rolesState.roles.find((role) => role.id === values.targetRoleId)
            : undefined;

        const result = await executeOnboardingSubmit({
            values,
            targetRole,
            onSuccess,
            destination,
        });

        if (!result.success) {
            setSubmitError(result.error || "We couldn't save your profile. Please try again.");
            setIsSubmitting(false);
        }
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
                        if (isLastStep) {
                            handleSubmit();
                        } else {
                            handleNext();
                        }
                    }}
                >
                    {submitError && (
                        <Alert variant="error" title="Unable to complete profile">
                            {submitError}
                        </Alert>
                    )}

                    {hasErrors && (
                        <Alert variant="error" title="Please fix the highlighted fields">
                            Some answers need a change before you can continue.
                        </Alert>
                    )}

                    {step === 0 && (
                        <StepGoal values={values} errors={errors} roles={rolesState.roles} onChange={handleChange} />
                    )}

                    {step === 1 && (
                        <StepSkills
                            values={values}
                            errors={errors}
                            role={rolesState.roles.find((role) => role.id === values.targetRoleId)}
                            onChange={handleChange}
                        />
                    )}

                    {step === 2 && (
                        <StepTutorStyle values={values} errors={errors} onChange={handleChange} />
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleBack}
                            disabled={step === 0 || isSubmitting}
                        >
                            Back
                        </Button>
                        {isLastStep ? (
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2"
                            >
                                {isSubmitting && <Spinner size="sm" className="text-white" />}
                                <span>{isSubmitting ? "Creating your learning path..." : "Create my learning path"}</span>
                            </Button>
                        ) : (
                            <Button type="submit">Next</Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
