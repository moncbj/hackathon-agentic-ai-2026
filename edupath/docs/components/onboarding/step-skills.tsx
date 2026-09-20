"use client";

import { Button } from "@/components/ui/button";
import { CvHelper } from "@/components/onboarding/cv-helper";
import { LevelSelector } from "@/components/onboarding/level-selector";
import { SKILL_LEVELS } from "@/app/onboarding/levels";
import { groupSkillsByCategory } from "@/app/onboarding/skill-groups";
import { LIMITS, isSkillLevel, type FormErrors, type OnboardingFormValues } from "@/app/onboarding/validation";
import type { ExtraSkill, Role, SkillLevel } from "@/app/_lib/api/onboarding-types";

interface StepSkillsProps {
    values: OnboardingFormValues;
    errors: FormErrors;
    role: Role;
    onChange: (patch: Partial<OnboardingFormValues>) => void;
}

const fieldClass =
    "rounded-xl border bg-white px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";

export function StepSkills({ values, errors, role, onChange }: StepSkillsProps) {
    const groups = groupSkillsByCategory(role.skills);

    function setLevels(patch: Record<string, SkillLevel>) {
        onChange({ skillLevels: { ...values.skillLevels, ...patch } });
    }

    function updateExtra(index: number, patch: Partial<ExtraSkill>) {
        onChange({
            extraSkills: values.extraSkills.map((skill, i) => (i === index ? { ...skill, ...patch } : skill)),
        });
    }

    function removeExtra(index: number) {
        onChange({ extraSkills: values.extraSkills.filter((_, i) => i !== index) });
    }

    function addExtra() {
        if (values.extraSkills.length >= LIMITS.extraSkillsMax) return;
        onChange({ extraSkills: [...values.extraSkills, { name: "", level: 1 }] });
    }

    const atLimit = values.extraSkills.length >= LIMITS.extraSkillsMax;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900">Your skills</h3>
                <p className="mt-1 text-sm text-slate-600">
                    Rate what you can do today for {role.name}, from 0 (no knowledge) to {SKILL_LEVELS.length - 1} (expert).
                    We check your levels as you learn, so an honest starting point works best.
                </p>
            </div>

            <CvHelper
                roleSkills={role.skills}
                skillLevels={values.skillLevels}
                extraSkills={values.extraSkills}
                onApplyLevels={setLevels}
                onChangeExtraSkills={(extraSkills) => onChange({ extraSkills })}
            />

            {errors.skillLevels && <p className="text-sm font-medium text-rose-700">{errors.skillLevels}</p>}

            {groups.map((group) => {
                const headingId = `skills-${group.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                return (
                    <section key={group.category} aria-labelledby={headingId} className="space-y-2">
                        <h4 id={headingId} className="text-base font-semibold text-slate-900">
                            {group.category}
                        </h4>
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                            {group.skills.map((skill) => {
                                const raw = values.skillLevels[skill.slug];
                                const level: SkillLevel = isSkillLevel(raw) ? raw : 0;
                                return (
                                    <li
                                        key={skill.slug}
                                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                                    >
                                        <div className="min-w-0 sm:max-w-xs">
                                            <p className="font-medium text-slate-900">{skill.name}</p>
                                            <p className="text-sm text-slate-600">{skill.description}</p>
                                        </div>
                                        <LevelSelector
                                            skillName={skill.name}
                                            value={level}
                                            onChange={(next) => setLevels({ [skill.slug]: next })}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}

            <section aria-labelledby="other-skills-heading" className="space-y-3">
                <div>
                    <h4 id="other-skills-heading" className="text-base font-semibold text-slate-900">
                        Other skills
                    </h4>
                    <p className="text-sm text-slate-600">
                        Optional. Skills outside this role. We keep them as notes and they don&apos;t change your plan.
                    </p>
                </div>

                {errors.extraSkills && <p className="text-sm font-medium text-rose-700">{errors.extraSkills}</p>}

                {values.extraSkills.length > 0 && (
                    <ul className="space-y-3">
                        {values.extraSkills.map((skill, index) => {
                            const nameError = errors[`extraSkills.${index}.name`];
                            const levelError = errors[`extraSkills.${index}.level`];
                            return (
                                <li key={index} className="space-y-1">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <input
                                            type="text"
                                            aria-label={`Other skill ${index + 1}, name`}
                                            aria-invalid={nameError ? true : undefined}
                                            placeholder="Skill name"
                                            maxLength={LIMITS.extraSkillNameMax}
                                            value={skill.name}
                                            onChange={(event) => updateExtra(index, { name: event.target.value })}
                                            onKeyDown={(event) => {
                                                // Enter should not jump to the next wizard step from here.
                                                if (event.key === "Enter") event.preventDefault();
                                            }}
                                            className={`${fieldClass} min-w-0 flex-1 ${nameError ? "border-rose-400" : "border-slate-300"}`}
                                        />
                                        <select
                                            aria-label={`Other skill ${index + 1}, level`}
                                            aria-invalid={levelError ? true : undefined}
                                            value={skill.level}
                                            onChange={(event) =>
                                                updateExtra(index, { level: Number(event.target.value) as SkillLevel })
                                            }
                                            className={`${fieldClass} ${levelError ? "border-rose-400" : "border-slate-300"}`}
                                        >
                                            {SKILL_LEVELS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.value} - {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeExtra(index)}
                                            aria-label={`Remove other skill ${index + 1}`}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                    {nameError && <p className="text-sm font-medium text-rose-700">{nameError}</p>}
                                    {levelError && <p className="text-sm font-medium text-rose-700">{levelError}</p>}
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className="flex items-center gap-3">
                    <Button type="button" variant="secondary" size="sm" onClick={addExtra} disabled={atLimit}>
                        Add a skill
                    </Button>
                    <span className="text-sm text-slate-500">
                        {values.extraSkills.length}/{LIMITS.extraSkillsMax}
                        {atLimit ? " (limit reached)" : ""}
                    </span>
                </div>
            </section>
        </div>
    );
}
