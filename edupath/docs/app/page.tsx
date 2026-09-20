import { LearnerGate } from "@/components/session/learner-gate";

/** Entry point: sends people without a profile to /onboarding, and everyone else to /dashboard. */
export default function Home() {
    return <LearnerGate redirectIfLearnerTo="/dashboard" />;
}
