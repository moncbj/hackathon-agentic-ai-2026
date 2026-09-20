// domain/skill-state.ts
// Pure, deterministic computation of initial skill states for onboarding (SPEC-001)

import { MINUTES_PER_LEVEL, PREREQ_MIN_LEVEL, SkillStatus } from './constants';

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

export interface SkillProgressInput {
  skillId: string;
  level: number;
  status: SkillStatus;
  progress: number;
}

export interface ActivityCompletionInput {
  minutes: number;
}

export interface UpdatedSkillProgress {
  skillId: string;
  level: number;
  status: SkillStatus;
  progress: number;
  readyForAssessment: boolean;
}

/**
 * Applies activity completion to update skill progress according to SPEC-003 §3.3.
 *
 * Rules:
 * 1. progressIncrease = round(activity.minutes / (currentGap * MINUTES_PER_LEVEL) * 100)
 * 2. progress is capped at 100.
 * 3. If status === 'available' and progress > 0, status becomes 'in_progress'.
 * 4. readyForAssessment is derived: progress >= 100.
 * 5. Level does NOT change upon activity completion (Rule R-04).
 */
export function applyActivityCompletion(
  skillState: SkillProgressInput,
  activity: ActivityCompletionInput,
  currentGap: number,
  config?: { minutesPerLevel?: number }
): UpdatedSkillProgress {
  const minutesPerLevel = config?.minutesPerLevel ?? MINUTES_PER_LEVEL;

  if (currentGap <= 0) {
    return {
      skillId: skillState.skillId,
      level: skillState.level,
      status: skillState.status,
      progress: 100,
      readyForAssessment: true,
    };
  }

  const progressIncrease = Math.round((activity.minutes / (currentGap * minutesPerLevel)) * 100);
  const newProgress = Math.min(100, skillState.progress + progressIncrease);

  let newStatus = skillState.status;
  if (newStatus === 'available' && newProgress > 0) {
    newStatus = 'in_progress';
  }

  return {
    skillId: skillState.skillId,
    level: skillState.level, // Level remains unchanged!
    status: newStatus,
    progress: newProgress,
    readyForAssessment: newProgress >= 100,
  };
}

export interface SkillStateForRecompute {
  skillId: string;
  level: number;
  status: SkillStatus;
  verification?: string;
  progress?: number;
  consecutiveFailures?: number;
  [key: string]: unknown;
}

/**
 * Recomputes locked and available statuses for skills based on updated prerequisite levels.
 * SPEC-004 §3.3:
 * Recalculates locked and available without touching acquired, struggling, or in_progress.
 * This ensures that a skill rising to PREREQ_MIN_LEVEL immediately unlocks its dependent skills.
 */
export function recomputeStatuses<T extends SkillStateForRecompute>(
  allSkillStates: T[],
  prerequisites: PrerequisiteInput[],
  _roleSkills?: RoleSkillInput[],
  config?: { prereqMinLevel?: number }
): T[] {
  const prereqMinLevel = config?.prereqMinLevel ?? PREREQ_MIN_LEVEL;

  // Map of skillId -> current level
  const levelMap = new Map<string, number>();
  for (const s of allSkillStates) {
    levelMap.set(s.skillId, s.level);
  }

  // Map of skillId -> list of prerequisite skillIds
  const prereqMap = new Map<string, string[]>();
  for (const prereq of prerequisites) {
    const list = prereqMap.get(prereq.skillId) || [];
    list.push(prereq.prerequisiteSkillId);
    prereqMap.set(prereq.skillId, list);
  }

  return allSkillStates.map((skill) => {
    // Only locked and available are subject to prerequisite recalculation
    if (skill.status !== 'locked' && skill.status !== 'available') {
      return skill;
    }

    const prereqIds = prereqMap.get(skill.skillId) || [];
    const hasUnmetPrereq = prereqIds.some((prereqId) => {
      const prereqLevel = levelMap.get(prereqId) ?? 0;
      return prereqLevel < prereqMinLevel;
    });

    const newStatus: SkillStatus = hasUnmetPrereq ? 'locked' : 'available';

    if (newStatus === skill.status) {
      return skill;
    }

    return {
      ...skill,
      status: newStatus,
    };
  });
}

export interface SkillStateSnapshot {
  skillId: string;
  level: number;
  status: SkillStatus;
}

/**
 * Determines whether journey replanning is required after a state update.
 * SPEC-004 §3.3:
 * Returns true if:
 * - any skill level changed
 * - any skill status changed (including unlocking or struggling)
 *
 * A passed verification where the level and status remain unchanged returns false.
 */
export function needsReplan(
  beforeStates: SkillStateSnapshot[],
  afterStates: SkillStateSnapshot[]
): boolean {
  const beforeMap = new Map<string, SkillStateSnapshot>();
  for (const b of beforeStates) {
    beforeMap.set(b.skillId, b);
  }

  for (const after of afterStates) {
    const before = beforeMap.get(after.skillId);
    if (!before) {
      return true; // New skill introduced
    }
    if (before.level !== after.level) {
      return true;
    }
    if (before.status !== after.status) {
      return true;
    }
  }

  return false;
}


