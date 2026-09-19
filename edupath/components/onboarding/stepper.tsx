import { IconCheckCircle } from "@/components/ui/icons";

interface StepperProps {
    steps: readonly string[];
    /** Zero-based index of the current step. */
    current: number;
}

export function Stepper({ steps, current }: StepperProps) {
    return (
        <ol className="flex items-center gap-2" aria-label="Onboarding progress">
            {steps.map((label, index) => {
                const isDone = index < current;
                const isCurrent = index === current;
                const circle = isDone
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : isCurrent
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-500 border-slate-300";

                return (
                    <li
                        key={label}
                        className="flex flex-1 items-center gap-2 last:flex-none"
                        aria-current={isCurrent ? "step" : undefined}
                    >
                        <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${circle}`}
                        >
                            {isDone ? <IconCheckCircle className="h-4 w-4" aria-hidden="true" /> : index + 1}
                        </span>
                        <span
                            className={`text-sm font-medium ${isCurrent ? "text-slate-900" : "hidden text-slate-500 sm:inline"}`}
                        >
                            <span className="sr-only">{isDone ? "Completed: " : isCurrent ? "Current step: " : "Upcoming: "}</span>
                            {label}
                        </span>
                        {index < steps.length - 1 && (
                            <span className={`h-0.5 flex-1 rounded ${isDone ? "bg-emerald-400" : "bg-slate-200"}`} aria-hidden="true" />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}