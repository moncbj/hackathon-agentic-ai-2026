import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
    title: "Set up your profile | EduPath",
};

export default function OnboardingPage() {
    return (
        <section className="mx-auto max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Set up your profile</h2>
                <p className="mt-1 text-slate-600">
                    It takes a few minutes. We use it to build a learning path that fits you.
                </p>
            </div>
            <OnboardingWizard />
        </section>
    );
}