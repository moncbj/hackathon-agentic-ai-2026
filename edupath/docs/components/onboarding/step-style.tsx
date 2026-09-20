"use client";

import { RadioCardGroup, type RadioCardOption } from "@/components/ui/radio-card-group";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { LIMITS, type FormErrors, type OnboardingFormValues } from "@/app/onboarding/validation";
import type { TutorDetail, TutorStyle, TutorTone } from "@/app/_lib/api/onboarding-types";

interface StepStyleProps {
    values: OnboardingFormValues;
    errors: FormErrors;
    onChange: (patch: Partial<OnboardingFormValues>) => void;
}

// Values are the API enums; only the labels are shown to the person.
const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
] as const;

const TONE_OPTIONS: ReadonlyArray<RadioCardOption<TutorTone>> = [
    { value: "formal", label: "Formal", description: "Precise and professional." },
    { value: "cercano", label: "Friendly", description: "Warm and conversational." },
    { value: "motivador", label: "Motivating", description: "Encouraging, celebrates progress." },
];

const DETAIL_OPTIONS: ReadonlyArray<RadioCardOption<TutorDetail>> = [
    { value: "resumido", label: "Concise", description: "Short answers with the key points." },
    { value: "equilibrado", label: "Balanced", description: "Enough context to follow along." },
    { value: "profundo", label: "In depth", description: "Thorough explanations and edge cases." },
];

export function StepStyle({ values, errors, onChange }: StepStyleProps) {
    const style = values.tutorStyle;

    function update(patch: Partial<TutorStyle>) {
        onChange({ tutorStyle: { ...style, ...patch } });
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900">How you like to learn</h3>
                <p className="mt-1 text-sm text-slate-600">
                    Your tutor will explain things the way you choose here.
                </p>
            </div>

            <SelectField
                label="Tutor language"
                required
                options={LANGUAGE_OPTIONS}
                value={style.language}
                error={errors.language}
                onChange={(event) => update({ language: event.target.value })}
                wrapperClassName="sm:max-w-xs"
            />

            <RadioCardGroup
                legend="Tone"
                options={TONE_OPTIONS}
                value={style.tone}
                error={errors.tone}
                onChange={(tone) => update({ tone })}
            />

            <RadioCardGroup
                legend="Level of detail"
                options={DETAIL_OPTIONS}
                value={style.detailLevel}
                error={errors.detailLevel}
                onChange={(detailLevel) => update({ detailLevel })}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
                <input
                    type="checkbox"
                    checked={style.useAnalogies}
                    onChange={(event) => update({ useAnalogies: event.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <span>
                    <span className="block text-sm font-semibold text-slate-900">Explain with analogies</span>
                    <span className="block text-sm text-slate-600">
                        Compares new ideas to things you already know.
                    </span>
                </span>
            </label>

            <TextAreaField
                label="Anything else your tutor should know"
                hint='Optional. For example: "Explain it with cooking examples."'
                maxLength={LIMITS.freeInstructionsMax}
                value={style.freeInstructions}
                error={errors.freeInstructions}
                onChange={(event) => update({ freeInstructions: event.target.value })}
            />
        </div>
    );
}
