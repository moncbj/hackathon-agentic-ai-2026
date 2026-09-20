"use client";

import { TextAreaField, TextField, SelectField } from "@/components/ui/field";
import { LIMITS, type FormErrors, type OnboardingFormValues } from "@/app/onboarding/validation";
import type { Role } from "@/app/_lib/api/onboarding-types";

interface StepGoalProps {
    values: OnboardingFormValues;
    errors: FormErrors;
    roles: Role[];
    onChange: (patch: Partial<OnboardingFormValues>) => void;
}

export function StepGoal({ values, errors, roles, onChange }: StepGoalProps) {
    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold text-slate-900">Your goal and context</h3>
                <p className="mt-1 text-sm text-slate-600">Tell us who you are and where you want to go.</p>
            </div>

            <TextField
                label="Name"
                required
                autoComplete="given-name"
                maxLength={LIMITS.nameMax}
                value={values.name}
                error={errors.name}
                onChange={(event) => onChange({ name: event.target.value })}
            />

            <SelectField
                label="Target role"
                required
                placeholder="Choose a role"
                options={roles.map((role) => ({ value: role.slug, label: role.name }))}
                value={values.targetRoleSlug}
                error={errors.targetRoleSlug}
                hint={roles.find((role) => role.slug === values.targetRoleSlug)?.description}
                onChange={(event) => onChange({ targetRoleSlug: event.target.value, skillLevels: {} })}
            />

            <TextAreaField
                label="Education or experience"
                hint="Optional. A few lines about your studies or work so far."
                maxLength={LIMITS.backgroundMax}
                value={values.background}
                error={errors.background}
                onChange={(event) => onChange({ background: event.target.value })}
            />

            <TextField
                label="Hours per week you can study"
                required
                type="number"
                inputMode="numeric"
                min={LIMITS.hoursMin}
                max={LIMITS.hoursMax}
                step={1}
                value={values.weeklyHours}
                error={errors.weeklyHours}
                hint={`A whole number from ${LIMITS.hoursMin} to ${LIMITS.hoursMax}.`}
                onChange={(event) => onChange({ weeklyHours: event.target.value })}
                wrapperClassName="sm:max-w-xs"
            />
        </div>
    );
}