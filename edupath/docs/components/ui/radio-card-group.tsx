"use client";

import { useId } from "react";

export interface RadioCardOption<T extends string> {
    value: T;
    label: string;
    description?: string;
}

interface RadioCardGroupProps<T extends string> {
    legend: string;
    options: ReadonlyArray<RadioCardOption<T>>;
    value: T;
    onChange: (value: T) => void;
    hint?: string;
    error?: string;
    /** Columns on screens wider than the mobile breakpoint. Defaults to 3. */
    columns?: 2 | 3;
}

/** Single-choice group rendered as selectable cards. Built on native radios, so keyboard and screen readers work. */
export function RadioCardGroup<T extends string>({
    legend,
    options,
    value,
    onChange,
    hint,
    error,
    columns = 3,
}: RadioCardGroupProps<T>) {
    const name = useId();
    const gridClass = columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

    return (
        <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium text-slate-800">{legend}</legend>
            {hint && !error && <p className="text-sm text-slate-500">{hint}</p>}
            <div className={`grid grid-cols-1 gap-2 ${gridClass}`}>
                {options.map((option) => (
                    <label key={option.value} className="relative block cursor-pointer">
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            className="peer sr-only"
                        />
                        <span className="block h-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm transition-colors hover:bg-slate-50 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:ring-1 peer-checked:ring-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2">
                            <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                            {option.description && (
                                <span className="mt-0.5 block text-sm text-slate-600">{option.description}</span>
                            )}
                        </span>
                    </label>
                ))}
            </div>
            {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
        </fieldset>
    );
}
