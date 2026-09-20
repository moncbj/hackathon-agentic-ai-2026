// domain/skill-state.ts
// Pure, deterministic computation of initial skill states for onboarding (SPEC-001)

import { PREREQ_MIN_LEVEL } from './constants';

export interface RoleSkillInput {
  skillId: string;
  requiredLevel: number;
}

export interface DeclaredLevel {
  skillId: string;
  level: number;
}

export interface PrerequisiteInput {
  skillId: string;
  prerequisiteSkillId: string;
}

export interface InitialSkillState {
  skillId: string;
  level: number;
  verification: 'self_reported';
  status: 'acquired' | 'locked' | 'available';
  progress: 0;
  consecutiveFailures: 0;
}

/**
 * Computes deterministic initial skill states for a learner upon onboarding.
 *
 * Evaluation rules:
 * 1. level = declared level for skill (defaults to 0 if omitted)
 * 2. verification = 'self_reported'
 * 3. progress = 0
 * 4. consecutiveFailures = 0
 * 5. status ordering:
 *    - 'acquired' if level >= requiredLevel
 *    - 'locked' if any prerequisite has a declared level < PREREQ_MIN_LEVEL (1)
 *    - 'available' otherwise
 *
 * CRITICAL: 'acquired' is evaluated before 'locked'.
 * The prerequisite check uses the prerequisite's declared level, NOT its status.
 */
export function computeInitialSkillStates(params: {
  roleSkills: RoleSkillInput[];
  declaredLevels: DeclaredLevel[];
  prerequisites: PrerequisiteInput[];
}): InitialSkillState[] {
  const { roleSkills, declaredLevels, prerequisites } = params;

  // Build a map of declared levels: skillId -> level (defaults to 0 if not found)
  const declaredMap = new Map<string, number>();
  for (const declared of declaredLevels) {
    declaredMap.set(declared.skillId, declared.level);
  }

  // Build a map of prerequisites: skillId -> array of prerequisiteSkillId
  const prereqMap = new Map<string, string[]>();
  for (const prereq of prerequisites) {
    const list = prereqMap.get(prereq.skillId) || [];
    list.push(prereq.prerequisiteSkillId);
    prereqMap.set(prereq.skillId, list);
  }

  return roleSkills.map((roleSkill) => {
    const level = declaredMap.get(roleSkill.skillId) ?? 0;

    let status: 'acquired' | 'locked' | 'available';

    if (level >= roleSkill.requiredLevel) {
      // 1. Acquired takes priority over locked
      status = 'acquired';
    } else {
      // 2. Check if any prerequisite's declared level is below PREREQ_MIN_LEVEL
      const prereqSkillIds = prereqMap.get(roleSkill.skillId) || [];
      const hasUnmetPrereq = prereqSkillIds.some((prereqId) => {
        const prereqLevel = declaredMap.get(prereqId) ?? 0;
        return prereqLevel < PREREQ_MIN_LEVEL;
      });

      if (hasUnmetPrereq) {
        status = 'locked';
      } else {
        status = 'available';
      }
    }

    return {
      skillId: roleSkill.skillId,
      level,
      verification: 'self_reported' as const,
      status,
      progress: 0 as const,
      consecutiveFailures: 0 as const,
    };
  });
}
