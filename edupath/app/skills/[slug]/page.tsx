import { SkillView } from "@/components/experience/learning-experience";
export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <SkillView slug={slug} />; }
