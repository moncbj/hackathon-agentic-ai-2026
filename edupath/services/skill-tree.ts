// services/skill-tree.ts
// Service for assembling the deterministic skill tree graph payload (SPEC-002)

import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getRoleById } from '@/lib/db/repositories/roles';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import { getPrerequisitesForSkills } from '@/lib/db/repositories/prerequisites';
import { computeGapAnalysis } from '@/domain/gaps';
import { SkillStatus, Verification } from '@/domain/constants';

export class SkillTreeError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_LEARNER' | 'NO_TARGET_ROLE' | 'ROLE_NOT_FOUND' | 'INTERNAL_ERROR',
    public readonly status: number
  ) {
    super(message);
    this.name = 'SkillTreeError';
  }
}

export interface SkillTreeNode {
  id: string;
  slug: string;
  name: string;
  level: number;
  requiredLevel: number;
  gap: number;
  weight: number;
  verification: Verification;
  status: SkillStatus;
  progress: number;
  needsVerification: boolean;
  depth: number;
}

export interface SkillTreeEdge {
  source: string; // prerequisite skill id
  target: string; // dependent skill id
}

export interface SkillTreeResponse {
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
}

/**
 * Retrieves the complete deterministic skill tree graph for the active learner.
 * Makes zero AI calls and zero database mutations.
 */
export async function getSkillTreeData(): Promise<SkillTreeResponse> {
  // 1. Fetch active learner
  const learner = await getActiveLearner();
  if (!learner) {
    throw new SkillTreeError('No active learner profile found', 'NO_LEARNER', 404);
  }

  if (!learner.target_role_id) {
    throw new SkillTreeError('Active learner has no target role specified', 'NO_TARGET_ROLE', 400);
  }

  // 2. Fetch target role
  const role = await getRoleById(learner.target_role_id);
  if (!role) {
    throw new SkillTreeError(`Target role "${learner.target_role_id}" not found`, 'ROLE_NOT_FOUND', 404);
  }

  // 3. Fetch role skills and learner skills
  const roleSkills = await getSkillsByRole(role.id);
  const learnerSkills = await getLearnerSkills(learner.id);

  // 4. Fetch prerequisites for role skills
  const roleSkillIdSet = new Set<string>(roleSkills.map((s) => s.id));
  const rawPrerequisites = await getPrerequisitesForSkills(Array.from(roleSkillIdSet));

  // Filter prerequisites to only include relationships within the role
  const prerequisites = rawPrerequisites.filter(
    (p) => roleSkillIdSet.has(p.skillId) && roleSkillIdSet.has(p.prerequisiteSkillId)
  );

  // 5. Compute deterministic gap analysis
  const gapResults = computeGapAnalysis({
    roleSkills: roleSkills.map((rs) => ({
      skillId: rs.id,
      skillSlug: rs.slug,
      name: rs.name,
      requiredLevel: rs.required_level,
      weight: rs.weight,
    })),
    learnerSkills: learnerSkills.map((ls) => ({
      skillId: ls.skill_id,
      level: ls.level,
      verification: ls.verification,
    })),
    prerequisites,
  });

  const gapMap = new Map(gapResults.map((gr) => [gr.skillId, gr]));
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, ls]));

  // 6. Build nodes
  const nodes: SkillTreeNode[] = roleSkills.map((rs) => {
    const gapData = gapMap.get(rs.id)!;
    const ls = learnerSkillMap.get(rs.id);

    const level = gapData.level;
    const verification: Verification = ls?.verification ?? 'self_reported';
    const progress = ls?.progress ?? 0;

    let status: SkillStatus;
    if (ls) {
      status = ls.status;
    } else {
      status = level >= rs.required_level ? 'acquired' : 'available';
    }

    return {
      id: rs.id,
      slug: rs.slug,
      name: rs.name,
      level,
      requiredLevel: rs.required_level,
      gap: gapData.gap,
      weight: rs.weight,
      verification,
      status,
      progress,
      needsVerification: gapData.needsVerification,
      depth: gapData.depth,
    };
  });

  // Sort nodes deterministically: depth ASC, name ASC, slug ASC
  nodes.sort((a, b) => {
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return a.slug.localeCompare(b.slug);
  });

  // 7. Build and deduplicate edges: source = prerequisite, target = dependent
  const edgeKeySet = new Set<string>();
  const edges: SkillTreeEdge[] = [];

  for (const p of prerequisites) {
    const key = `${p.prerequisiteSkillId}->${p.skillId}`;
    if (!edgeKeySet.has(key)) {
      edgeKeySet.add(key);
      edges.push({
        source: p.prerequisiteSkillId,
        target: p.skillId,
      });
    }
  }

  // Sort edges deterministically: source ASC, target ASC
  edges.sort((a, b) => {
    const srcCmp = a.source.localeCompare(b.source);
    if (srcCmp !== 0) {
      return srcCmp;
    }
    return a.target.localeCompare(b.target);
  });

  return { nodes, edges };
}
