"use client";

import { SelectField, TextAreaField } from "@/components/ui/field";
import type { FormErrors, OnboardingFormValues } from "@/app/onboarding/validation";

interface StepTutorStyleProps { values: OnboardingFormValues; errors: FormErrors; onChange: (patch: Partial<OnboardingFormValues>) => void; }
export function StepTutorStyle({ values, errors, onChange }: StepTutorStyleProps) {
  const style = values.tutorStyle;
  const update = (patch: Partial<typeof style>) => onChange({ tutorStyle: { ...style, ...patch } });
  return <div className="space-y-5"><div><h3 className="text-lg font-semibold">Tutor style</h3><p className="text-sm text-slate-600">Choose how you want explanations delivered.</p></div><SelectField label="Language" options={[{ value: "en", label: "English" }, { value: "es", label: "Spanish" }]} value={style.language} error={errors.language} onChange={(event) => update({ language: event.target.value })} /><SelectField label="Tone" options={["formal", "cercano", "motivador"].map((value) => ({ value, label: value }))} value={style.tone} error={errors.tone} onChange={(event) => update({ tone: event.target.value as typeof style.tone })} /><TextAreaField label="Additional instructions" maxLength={500} value={style.freeInstructions} error={errors.freeInstructions} onChange={(event) => update({ freeInstructions: event.target.value })} /></div>;
}
