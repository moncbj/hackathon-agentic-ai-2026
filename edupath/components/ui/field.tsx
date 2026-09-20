"use client";

import React, { useId } from "react";

interface FieldShellProps {
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    className?: string;
    /** Text shown at the right of the label row, e.g. a character counter. */
    meta?: string;
    children: (ids: { inputId: string; describedBy: string | undefined }) => React.ReactNode;
}

function FieldShell({ label, hint, error, required, className = "", meta, children }: FieldShellProps) {
    const baseId = useId();
    const inputId = `${baseId}-input`;
    const hintId = `${baseId}-hint`;
    const errorId = `${baseId}-error`;
    const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
                    {label}
                    {required && (
                        <span className="ml-0.5 text-rose-600" aria-hidden="true">
                            *
                        </span>
                    )}
                </label>
                {meta && <span className="text-xs text-slate-500">{meta}</span>}
            </div>
            {children({ inputId, describedBy })}
            {hint && !error && (
                <p id={hintId} className="text-sm text-slate-500">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} className="text-sm font-medium text-rose-700">
                    {error}
                </p>
            )}
        </div>
    );
}

const inputBase =
    "w-full rounded-xl border bg-white px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";

const inputClass = (hasError: boolean) => `${inputBase} ${hasError ? "border-rose-400" : "border-slate-300"}`;

interface CommonFieldProps {
    label: string;
    hint?: string;
    error?: string;
    wrapperClassName?: string;
}

export type TextFieldProps = CommonFieldProps &
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export function TextField({ label, hint, error, wrapperClassName, required, ...props }: TextFieldProps) {
    return (
        <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
            {({ inputId, describedBy }) => (
                <input
                    id={inputId}
                    className={inputClass(Boolean(error))}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    required={required}
                    {...props}
                />
            )}
        </FieldShell>
    );
}

export type TextAreaFieldProps = CommonFieldProps &
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">;

export function TextAreaField({
    label,
    hint,
    error,
    wrapperClassName,
    required,
    maxLength,
    value,
    ...props
}: TextAreaFieldProps) {
    const length = typeof value === "string" ? value.length : 0;
    const meta = maxLength ? `${length}/${maxLength}` : undefined;

    return (
        <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName} meta={meta}>
            {({ inputId, describedBy }) => (
                <textarea
                    id={inputId}
                    className={`${inputClass(Boolean(error))} min-h-24 resize-y`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    required={required}
                    value={value}
                    {...props}
                />
            )}
        </FieldShell>
    );
}

export type SelectFieldProps = CommonFieldProps &
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> & {
        options: ReadonlyArray<{ value: string; label: string }>;
        placeholder?: string;
    };

export function SelectField({
    label,
    hint,
    error,
    wrapperClassName,
    required,
    options,
    placeholder,
    ...props
}: SelectFieldProps) {
    return (
        <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
            {({ inputId, describedBy }) => (
                <select
                    id={inputId}
                    className={inputClass(Boolean(error))}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    required={required}
                    {...props}
                >
                    {placeholder && <option value="">{placeholder}</option>}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            )}
        </FieldShell>
    );
}
