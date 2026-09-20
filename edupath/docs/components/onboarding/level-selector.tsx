"use client";

import { useId } from "react";
import { SKILL_LEVELS, getLevelInfo } from "@/app/onboarding/levels";
import type { SkillLevel } from "@/app/_lib/api/onboarding-types";

interface LevelSelectorProps {
    /** Name of the skill being rated, used for the accessible group label. */
    skillName: string;
    value: SkillLevel;
    onChange: (level: SkillLevel) => void;
}

/** Segmented 0 to 4 control. Native radios keep it keyboard accessible (arrow keys move between levels). */
export function LevelSelector({ skillName, value, onChange }: LevelSelectorProps) {
    const name = useId();
    const current = getLevelInfo(value);

    return (
        <fieldset className="min-w-0">
            <legend className="sr-only">{`Your level in ${skillName}`}</legend>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                {SKILL_LEVELS.map((level) => (
                    <label key={level.value} className="relative block cursor-pointer border-l border-slate-200 first:border-l-0">
                        <input
                            type="radio"
                            name={name}
                            value={level.value}
                            checked={value === level.value}
                            onChange={() => onChange(level.value)}
                            aria-label={`Level ${level.value}, ${level.label}`}
                            className="peer sr-only"
                        />
                        <span className="flex h-10 w-11 items-center justify-center text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:z-10 peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-indigo-500">
                            {level.value}
                        </span>
                    </label>
                ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500" aria-live="polite">
                <span className="font-medium text-slate-700">{current.label}.</span> {current.description}
            </p>
        </fieldset>
    );
}
