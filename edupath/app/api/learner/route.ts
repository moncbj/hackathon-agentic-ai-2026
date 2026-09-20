// app/api/learner/route.ts
// HTTP handler to fetch active learner profile (SPEC-001)

import { NextResponse } from 'next/server';
import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getTutorStyle } from '@/lib/db/repositories/tutor-styles';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import { getSkillsByRole, getSkills } from '@/lib/db/repositories/skills';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const learner = await getActiveLearner();
    if (!learner) {
      return NextResponse.json(
        { error: 'No learner profile found' },
        { status: 404 }
      );
    }

    const tutorStyle = await getTutorStyle(learner.id);
    const learnerSkills = await getLearnerSkills(learner.id);

    // Fetch skills metadata for enrichment
    let roleSkillsMap = new Map<string, { slug: string; name: string; required_level: number }>();
    if (learner.target_role_id) {
      const roleSkills = await getSkillsByRole(learner.target_role_id);
      roleSkillsMap = new Map(
        roleSkills.map((s) => [s.id, { slug: s.slug, name: s.name, required_level: s.required_level }])
      );
    } else {
      const allSkills = await getSkills();
      roleSkillsMap = new Map(
        allSkills.map((s) => [s.id, { slug: s.slug, name: s.name, required_level: 0 }])
      );
    }

    const skillStates = learnerSkills.map((ls) => {
      const meta = roleSkillsMap.get(ls.skill_id);
      return {
        skillId: ls.skill_id,
        skillSlug: meta?.slug ?? '',
        skillName: meta?.name ?? '',
        level: ls.level,
        requiredLevel: meta?.required_level ?? 0,
        verification: ls.verification,
        status: ls.status,
        progress: ls.progress,
        consecutiveFailures: ls.consecutive_failures,
      };
    });

    return NextResponse.json(
      {
        learner: {
          id: learner.id,
          name: learner.name,
          targetRoleId: learner.target_role_id,
          background: learner.background,
          weeklyHours: learner.weekly_hours,
          extraSkills: learner.extra_skills,
          createdAt: learner.created_at,
        },
        tutorStyle: tutorStyle
          ? {
              language: tutorStyle.language,
              tone: tutorStyle.tone,
              detailLevel: tutorStyle.detail_level,
              useAnalogies: tutorStyle.use_analogies,
              freeInstructions: tutorStyle.free_instructions,
            }
          : null,
        skillStates,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to fetch learner profile',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
