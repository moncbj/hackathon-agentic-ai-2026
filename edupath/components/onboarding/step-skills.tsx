"use client";

import { SelectField, TextField } from "@/components/ui/field";
import type { FormErrors, OnboardingFormValues } from "@/app/onboarding/validation";
import type { Role } from "@/app/_lib/api/onboarding-types";

interface Props { values: OnboardingFormValues; errors: FormErrors; role?: Role; onChange: (patch: Partial<OnboardingFormValues>) => void; }
const levelOptions = [0, 1, 2, 3, 4].map((level) => ({ value: String(level), label: String(level) }));

export function StepSkills({ values, errors, role, onChange }: Props) {
  const setLevel = (slug: string, level: number) => onChange({ declaredLevels: { ...values.declaredLevels, [slug]: level as 0 | 1 | 2 | 3 | 4 } });
  return <div className="space-y-5"><div><h3 className="text-lg font-semibold">Your skills</h3><p className="text-sm text-slate-600">Rate your current familiarity from 0 to 4.</p></div>{role?.skills.map((skill) => <SelectField key={skill.id} label={skill.name} options={levelOptions} value={String(values.declaredLevels[skill.slug] ?? 0)} onChange={(event) => setLevel(skill.slug, Number(event.target.value))} />)}<TextField label="Other skill (optional)" value={values.extraSkills[0]?.name ?? ""} error={errors["extraSkills.0.name"]} onChange={(event) => onChange({ extraSkills: event.target.value ? [{ name: event.target.value, level: 0 }] : [] })} /></div>;
}
