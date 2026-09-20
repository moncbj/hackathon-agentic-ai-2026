import { AssessmentView } from "@/components/experience/learning-experience";
export default async function AssessmentPage({ params }: { params: Promise<{ skillSlug: string }> }) { const { skillSlug } = await params; return <AssessmentView slug={skillSlug} />; }
