// services/onboarding.ts
// Orchestration for learner onboarding with sequential creation and compensating rollback (SPEC-001)

import { Tone, DetailLevel } from '@/domain/constants';
import { computeInitialSkillStates } from '@/domain/skill-state';
import {
  getActiveLearner,
  createLearner,
  deleteLearner,
} from '@/lib/db/repositories/learners';
import { getRoleById } from '@/lib/db/repositories/roles';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { getPrerequisitesForSkills } from '@/lib/db/repositories/prerequisites';
import { createTutorStyle } from '@/lib/db/repositories/tutor-styles';
import { createLearnerSkills } from '@/lib/db/repositories/learner-skills';

export class OnboardingError extends Error {
  constructor(
    message: string,
    public readonly code: 'LEARNER_EXISTS' | 'ROLE_NOT_FOUND' | 'ROLE_NO_SKILLS' | 'DB_ERROR',
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

export interface OnboardingInput {
  name: string;
  background?: string;
  targetRoleId: string;
  weeklyHours: number;
  declaredLevels?: Record<string, number>;
  extraSkills?: Array<{ name: string; level: number }>;
  tutorStyle: {
    language?: string;
    tone: Tone;
    detailLevel: DetailLevel;
    useAnalogies: boolean;
    freeInstructions?: string;
  };
}

export interface OnboardingResult {
  learner: {
    id: string;
    name: string;
    targetRoleId: string;
    background: string;
    weeklyHours: number;
    extraSkills: Array<{ name: string; level: number }>;
    createdAt: string;
  };
  tutorStyle: {
    language: string;
    tone: Tone;
    detailLevel: DetailLevel;
    useAnalogies: boolean;
    freeInstructions: string;
  };
  skillStates: Array<{
    skillId: string;
    skillSlug: string;
    skillName: string;
    level: number;
    requiredLevel: number;
    verification: 'self_reported';
    status: 'acquired' | 'locked' | 'available';
    progress: 0;
    consecutiveFailures: 0;
  }>;
}

/**
 * Creates the learner profile, tutor styles, and initial skill states.
 *
 * Concurrency Note:
 * This check-then-insert is advisory for a single-user MVP.
 * Two simultaneous requests can race; this limitation is accepted without distributed locking.
 *
 * Rollback Note:
 * This is sequential creation with compensating rollback (not an atomic DB transaction).
 * If any step fails after learner creation, deleteLearner(id) is invoked.
 * Database foreign key ON DELETE CASCADE automatically removes dependent tutor_styles and learner_skills.
 */
export async function createOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  // 1. Advisory existing learner check
  const activeLearner = await getActiveLearner();
  if (activeLearner !== null) {
    throw new OnboardingError(
      'A learner already exists. Use POST /api/demo/reset to start over.',
      'LEARNER_EXISTS',
      409
    );
  }

  // 2. Validate target role exists
  const role = await getRoleById(input.targetRoleId);
  if (!role) {
    throw new OnboardingError('Role not found', 'ROLE_NOT_FOUND', 404);
  }

  // 3. Fetch role skills
  const roleSkills = await getSkillsByRole(role.id);
  if (roleSkills.length === 0) {
    throw new OnboardingError('Selected role has no skills', 'ROLE_NO_SKILLS', 400);
  }

  // 4. Map declared levels
  const declaredLevels = roleSkills.map((s) => ({
    skillId: s.id,
    level: input.declaredLevels?.[s.id] ?? input.declaredLevels?.[s.slug] ?? 0,
  }));

  // 5. Fetch prerequisites for the role skills
  const skillIds = roleSkills.map((s) => s.id);
  const prerequisites = await getPrerequisitesForSkills(skillIds);

  // 6. Deterministically compute initial skill states
  const initialStates = computeInitialSkillStates({
    roleSkills: roleSkills.map((s) => ({
      skillId: s.id,
      requiredLevel: s.required_level,
    })),
    declaredLevels,
    prerequisites,
  });

  // 7. Sequential persistence with compensating rollback
  let createdLearnerId: string | null = null;

  try {
    // 7a. Insert learner
    const learner = await createLearner({
      name: input.name,
      targetRoleId: role.id,
      background: input.background ?? '',
      weeklyHours: input.weeklyHours,
      extraSkills: input.extraSkills ?? [],
    });
    createdLearnerId = learner.id;

    // 7b. Insert tutor style
    const tutorStyle = await createTutorStyle({
      learnerId: learner.id,
      language: input.tutorStyle.language ?? 'es',
      tone: input.tutorStyle.tone,
      detailLevel: input.tutorStyle.detailLevel,
      useAnalogies: input.tutorStyle.useAnalogies,
      freeInstructions: input.tutorStyle.freeInstructions ?? '',
    });

    // 7c. Bulk insert learner skills
    await createLearnerSkills(
      learner.id,
      initialStates.map((st) => ({
        skillId: st.skillId,
        level: st.level,
        verification: st.verification,
        status: st.status,
        progress: st.progress,
        consecutiveFailures: st.consecutiveFailures,
      }))
    );

    // Enrich skills with metadata for response
    const skillMap = new Map(roleSkills.map((s) => [s.id, s]));
    const enrichedSkillStates = initialStates.map((st) => {
      const meta = skillMap.get(st.skillId);
      return {
        skillId: st.skillId,
        skillSlug: meta?.slug ?? '',
        skillName: meta?.name ?? '',
        level: st.level,
        requiredLevel: meta?.required_level ?? 0,
        verification: st.verification,
        status: st.status,
        progress: st.progress,
        consecutiveFailures: st.consecutiveFailures,
      };
    });

    return {
      learner: {
        id: learner.id,
        name: learner.name,
        targetRoleId: learner.target_role_id ?? role.id,
        background: learner.background,
        weeklyHours: learner.weekly_hours,
        extraSkills: learner.extra_skills,
        createdAt: learner.created_at,
      },
      tutorStyle: {
        language: tutorStyle.language,
        tone: tutorStyle.tone,
        detailLevel: tutorStyle.detail_level,
        useAnalogies: tutorStyle.use_analogies,
        freeInstructions: tutorStyle.free_instructions,
      },
      skillStates: enrichedSkillStates,
    };
  } catch (err) {
    // Compensating rollback: delete learner cascades to tutor_styles and learner_skills
    if (createdLearnerId) {
      try {
        await deleteLearner(createdLearnerId);
      } catch (rollbackErr) {
        console.error(
          `[Compensating Rollback Failed] Failed to delete learner "${createdLearnerId}":`,
          rollbackErr
        );
      }
    }

    if (err instanceof OnboardingError) {
      throw err;
    }

    throw new OnboardingError(
      'Failed to create learner profile',
      'DB_ERROR',
      500,
      err instanceof Error ? err.message : String(err)
    );
  }
}
