// domain/gaps.ts
// Pure, deterministic computation of skill gaps, priorities, and verification needs (SPEC-002)

import { PRIORITY_DEPENDENT_BONUS, VERIFY_MIN_WEIGHT } from './constants';

export interface GapAnalysisRoleSkill {
  skillId: string;
  skillSlug: string;
  name: string;
  requiredLevel: number;
  weight: number;
}

export interface GapAnalysisLearnerSkill {
  skillId: string;
  level: number;
  verification: 'self_reported' | 'verified';
}

export interface GapAnalysisPrerequisite {
  skillId: string;            // dependent skill
  prerequisiteSkillId: string; // prerequisite skill
}

export interface GapAnalysisResult {
  skillId: string;
  skillSlug: string;
  name: string;
  level: number;
  requiredLevel: number;
  weight: number;
  gap: number;
  dependentsWithGap: number;
  priority: number;
  needsVerification: boolean;
  depth: number;
}

/**
 * Computes deterministic skill gaps, dependency depths, priorities, and verification flags
 * for all skills in a target role.
 *
 * Rules:
 * 1. Missing learner skill defaults to level 0 and verification 'self_reported'.
 * 2. gap = Math.max(0, requiredLevel - level).
 * 3. dependentsWithGap = count of direct dependent skills in the role with gap > 0.
 * 4. depth = longest prerequisite chain to this skill (root = 0, depth = max(prereq.depth) + 1).
 * 5. priority = weight * gap * (1 + PRIORITY_DEPENDENT_BONUS * dependentsWithGap).
 * 6. needsVerification = (gap === 0 && verification === 'self_reported' && weight >= VERIFY_MIN_WEIGHT).
 * 7. Sorted deterministically by priority DESC, depth ASC, name ASC, skillSlug ASC.
 *
 * Pure function: No DB, network, or AI calls.
 */
export function computeGapAnalysis(params: {
  roleSkills: GapAnalysisRoleSkill[];
  learnerSkills: GapAnalysisLearnerSkill[];
  prerequisites: GapAnalysisPrerequisite[];
}): GapAnalysisResult[] {
  const { roleSkills, learnerSkills, prerequisites } = params;

  // 1. Map learner skills by skillId
  const learnerSkillMap = new Map<string, GapAnalysisLearnerSkill>();
  for (const ls of learnerSkills) {
    learnerSkillMap.set(ls.skillId, ls);
  }

  // 2. Set of role skill IDs for filtering
  const roleSkillIds = new Set<string>(roleSkills.map((rs) => rs.skillId));

  // 3. Preliminary gap calculation for each role skill
  const gapsBySkillId = new Map<string, number>();
  for (const rs of roleSkills) {
    const ls = learnerSkillMap.get(rs.skillId);
    const level = ls?.level ?? 0;
    const gap = Math.max(0, rs.requiredLevel - level);
    gapsBySkillId.set(rs.skillId, gap);
  }

  // 4. Build prerequisite mappings and deduplicate edges
  // prereqsBySkill: dependentSkillId -> Set of prerequisiteSkillIds
  // dependentsBySkill: prerequisiteSkillId -> Set of dependentSkillIds
  const prereqsBySkill = new Map<string, Set<string>>();
  const dependentsBySkill = new Map<string, Set<string>>();

  for (const p of prerequisites) {
    // Only consider edges where both skills are part of this role
    if (roleSkillIds.has(p.skillId) && roleSkillIds.has(p.prerequisiteSkillId)) {
      // Record prerequisite for dependent
      let prereqSet = prereqsBySkill.get(p.skillId);
      if (!prereqSet) {
        prereqSet = new Set<string>();
        prereqsBySkill.set(p.skillId, prereqSet);
      }
      prereqSet.add(p.prerequisiteSkillId);

      // Record direct dependent for prerequisite
      let depSet = dependentsBySkill.get(p.prerequisiteSkillId);
      if (!depSet) {
        depSet = new Set<string>();
        dependentsBySkill.set(p.prerequisiteSkillId, depSet);
      }
      depSet.add(p.skillId);
    }
  }

  // 5. Compute depth with cycle detection
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();

  function getDepth(skillId: string): number {
    if (depthMemo.has(skillId)) {
      return depthMemo.get(skillId)!;
    }
    if (visiting.has(skillId)) {
      throw new Error(`Cycle detected in prerequisites graph involving skill "${skillId}"`);
    }

    visiting.add(skillId);
    const prereqSet = prereqsBySkill.get(skillId);
    let maxPrereqDepth = -1;

    if (prereqSet && prereqSet.size > 0) {
      for (const prereqId of prereqSet) {
        const d = getDepth(prereqId);
        if (d > maxPrereqDepth) {
          maxPrereqDepth = d;
        }
      }
    }

    visiting.delete(skillId);
    const depth = maxPrereqDepth + 1;
    depthMemo.set(skillId, depth);
    return depth;
  }

  // Calculate depths for all role skills
  for (const rs of roleSkills) {
    getDepth(rs.skillId);
  }

  // 6. Assemble results for all role skills
  const results: GapAnalysisResult[] = roleSkills.map((rs) => {
    const ls = learnerSkillMap.get(rs.skillId);
    const level = ls?.level ?? 0;
    const verification = ls?.verification ?? 'self_reported';
    const gap = gapsBySkillId.get(rs.skillId) ?? 0;

    // Direct dependents with gap > 0
    const directDeps = dependentsBySkill.get(rs.skillId);
    let dependentsWithGap = 0;
    if (directDeps) {
      for (const depId of directDeps) {
        const depGap = gapsBySkillId.get(depId) ?? 0;
        if (depGap > 0) {
          dependentsWithGap++;
        }
      }
    }

    // Priority formula: weight * gap * (1 + PRIORITY_DEPENDENT_BONUS * dependentsWithGap)
    const priority = rs.weight * gap * (1 + PRIORITY_DEPENDENT_BONUS * dependentsWithGap);

    // Needs verification formula: gap === 0 && verification === 'self_reported' && weight >= VERIFY_MIN_WEIGHT
    const needsVerification =
      gap === 0 && verification === 'self_reported' && rs.weight >= VERIFY_MIN_WEIGHT;

    const depth = depthMemo.get(rs.skillId) ?? 0;

    return {
      skillId: rs.skillId,
      skillSlug: rs.skillSlug,
      name: rs.name,
      level,
      requiredLevel: rs.requiredLevel,
      weight: rs.weight,
      gap,
      dependentsWithGap,
      priority,
      needsVerification,
      depth,
    };
  });

  // 7. Sort deterministically:
  // - priority DESC
  // - depth ASC
  // - name ASC
  // - skillSlug ASC
  results.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return a.skillSlug.localeCompare(b.skillSlug);
  });

  return results;
}
