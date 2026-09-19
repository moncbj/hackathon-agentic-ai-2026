// app/status/page.tsx
import { HealthStatus } from "@/components/health/health-status";

export default function StatusPage() {
    return (
        <section className="mx-auto max-w-3xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Welcome to EduPath
                </h2>
                <p className="mt-1 text-slate-600">
                    Your personalized learning path, verified as you go.
                </p>
            </div>
            <HealthStatus />
        </section>
    );
}