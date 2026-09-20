// services/gaps.ts
// Service for deterministic gap analysis and cached agent explanations (SPEC-002)

import crypto from 'crypto';
import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getRoleById } from '@/lib/db/repositories/roles';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import { getPrerequisitesForSkills } from '@/lib/db/repositories/prerequisites';
import { getTutorStyle, TutorStyleRecord } from '@/lib/db/repositories/tutor-styles';
import {
  getGapAnalysisCache,
  saveGapAnalysisCache,
} from '@/lib/db/repositories/gap-analyses';
import { computeGapAnalysis, GapAnalysisResult } from '@/domain/gaps';
import {
  GapAnalysisAgentOutput,
  GapAnalysisAgentOutputSchema,
  GapExplanationSkill,
} from '@/agents/gap-analysis/schema';
import { runGapAnalysisAgent } from '@/agents/gap-analysis/run';

export class GapsServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_LEARNER' | 'NO_TARGET_ROLE' | 'ROLE_NOT_FOUND' | 'INTERNAL_ERROR',
    public readonly status: number
  ) {
    super(message);
    this.name = 'GapsServiceError';
  }
}

export interface GapsResponse {
  summary: {
    totalSkills: number;
    acquired: number;
    withGap: number;
    needsVerification: number;
  };
  gaps: Array<{
    skillSlug: string;
    name: string;
    level: number;
    requiredLevel: number;
    gap: number;
    priority: number;
    needsVerification: boolean;
  }>;
  topPriorities: Array<{
    skillSlug: string;
    name: string;
    gap: number;
    priority: number;
  }>;
  unverified: Array<{
    skillSlug: string;
    name: string;
    level: number;
  }>;
  agentExplanation: {
    summary: string;
    perSkill: Array<{
      skillSlug: string;
      explanation: string;
      whyItMatters: string;
    }>;
    recommendedFocus: string[];
  } | null;
}

/**
 * Sanitizes agent output by stripping invalid slugs, deduplicating, and capping recommendedFocus to 3.
 */
export function sanitizeAgentOutput(
  output: GapAnalysisAgentOutput,
  allowedSlugs: string[]
): GapAnalysisAgentOutput {
  const allowedSet = new Set(allowedSlugs);

  const seenPerSkill = new Set<string>();
  const sanitizedPerSkill: GapExplanationSkill[] = [];
  for (const item of output.perSkill) {
    if (allowedSet.has(item.skillSlug) && !seenPerSkill.has(item.skillSlug)) {
      seenPerSkill.add(item.skillSlug);
      sanitizedPerSkill.push(item);
    }
  }

  const seenFocus = new Set<string>();
  const sanitizedFocus: string[] = [];
  for (const slug of output.recommendedFocus) {
    if (allowedSet.has(slug) && !seenFocus.has(slug)) {
      seenFocus.add(slug);
      sanitizedFocus.push(slug);
      if (sanitizedFocus.length === 3) {
        break;
      }
    }
  }

  return {
    summary: output.summary,
    perSkill: sanitizedPerSkill,
    recommendedFocus: sanitizedFocus,
  };
}

/**
 * Computes deterministic gap analysis and generates or fetches cached agent explanation.
 * Falls back gracefully to deterministic data if the agent or cache fails.
 */
export async function getGapAnalysisAndExplanation(): Promise<GapsResponse> {
  // 1. Fetch active learner
  const learner = await getActiveLearner();
  if (!learner) {
    throw new GapsServiceError('No active learner profile found', 'NO_LEARNER', 404);
  }

  if (!learner.target_role_id) {
    throw new GapsServiceError('Active learner has no target role specified', 'NO_TARGET_ROLE', 400);
  }

  // 2. Fetch target role
  const role = await getRoleById(learner.target_role_id);
  if (!role) {
    throw new GapsServiceError(`Target role "${learner.target_role_id}" not found`, 'ROLE_NOT_FOUND', 404);
  }

  // 3. Fetch role skills, learner skills, prerequisites, and tutor style
  const roleSkills = await getSkillsByRole(role.id);
  const learnerSkills = await getLearnerSkills(learner.id);

  const roleSkillIdSet = new Set<string>(roleSkills.map((s) => s.id));
  const rawPrerequisites = await getPrerequisitesForSkills(Array.from(roleSkillIdSet));
  const prerequisites = rawPrerequisites.filter(
    (p) => roleSkillIdSet.has(p.skillId) && roleSkillIdSet.has(p.prerequisiteSkillId)
  );

  const rawTutorStyle = await getTutorStyle(learner.id);
  const tutorStyle: TutorStyleRecord = rawTutorStyle ?? {
    learner_id: learner.id,
    language: 'es',
    tone: 'cercano',
    detail_level: 'equilibrado',
    use_analogies: true,
    free_instructions: '',
    created_at: new Date().toISOString(),
  };

  // 4. Compute deterministic gap analysis
  const gapResults: GapAnalysisResult[] = computeGapAnalysis({
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

  // 5. Construct summary metrics
  const totalSkills = gapResults.length;
  let acquired = 0;
  let withGap = 0;
  let needsVerificationCount = 0;

  for (const gr of gapResults) {
    if (gr.gap === 0) {
      acquired++;
    } else {
      withGap++;
    }
    if (gr.needsVerification) {
      needsVerificationCount++;
    }
  }

  const summary = {
    totalSkills,
    acquired,
    withGap,
    needsVerification: needsVerificationCount,
  };

  // 6. Build deterministic gaps list (contains ALL role skills sorted by priority DESC, depth ASC, name ASC, slug ASC)
  const gaps = gapResults.map((gr) => ({
    skillSlug: gr.skillSlug,
    name: gr.name,
    level: gr.level,
    requiredLevel: gr.requiredLevel,
    gap: gr.gap,
    priority: gr.priority,
    needsVerification: gr.needsVerification,
  }));

  // 7. Top priorities: up to 5 entries with priority > 0
  const topPriorities = gaps
    .filter((g) => g.priority > 0)
    .slice(0, 5)
    .map((g) => ({
      skillSlug: g.skillSlug,
      name: g.name,
      gap: g.gap,
      priority: g.priority,
    }));

  // 8. Unverified: skills where needsVerification === true
  const unverified = gaps
    .filter((g) => g.needsVerification)
    .map((g) => ({
      skillSlug: g.skillSlug,
      name: g.name,
      level: g.level,
    }));

  // 9. Check if there are gaps or verifications to explain
  const positiveGaps = gaps.filter((g) => g.gap > 0);
  if (positiveGaps.length === 0 && unverified.length === 0) {
    return {
      summary,
      gaps,
      topPriorities,
      unverified,
      agentExplanation: null,
    };
  }

  // 10. Canonical input for caching and agent invocation
  // Sort arrays deterministically by skillSlug
  const sortedGaps = [...positiveGaps].sort((a, b) => a.skillSlug.localeCompare(b.skillSlug));
  const sortedToVerify = [...unverified].sort((a, b) => a.skillSlug.localeCompare(b.skillSlug));

  const canonicalInput = {
    cacheVersion: 'gap-analysis-v1',
    role: { name: role.name },
    gaps: sortedGaps.map((g) => ({
      skillSlug: g.skillSlug,
      name: g.name,
      level: g.level,
      requiredLevel: g.requiredLevel,
      gap: g.gap,
      priority: g.priority,
    })),
    toVerify: sortedToVerify.map((v) => ({
      skillSlug: v.skillSlug,
      name: v.name,
      level: v.level,
    })),
    tutorStyle: {
      language: tutorStyle.language,
      tone: tutorStyle.tone,
      detailLevel: tutorStyle.detail_level,
      useAnalogies: tutorStyle.use_analogies,
      freeInstructions: tutorStyle.free_instructions,
    },
  };

  const inputHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalInput))
    .digest('hex');

  const allowedRoleSlugs = roleSkills.map((s) => s.slug);

  // 11. Check cache
  try {
    const cached = await getGapAnalysisCache(learner.id, inputHash);
    if (cached) {
      const parsed = GapAnalysisAgentOutputSchema.safeParse(cached.result);
      if (parsed.success) {
        const sanitized = sanitizeAgentOutput(parsed.data, allowedRoleSlugs);
        return {
          summary,
          gaps,
          topPriorities,
          unverified,
          agentExplanation: sanitized,
        };
      }
    }
  } catch (cacheReadError) {
    // Soft failure: log and treat as cache miss
    console.warn('Failed to read gap analysis cache; proceeding to run agent:', cacheReadError);
  }

  // 12. Run Gap Analysis Agent on cache miss
  let agentExplanation: GapAnalysisAgentOutput | null = null;
  try {
    const rawOutput = await runGapAnalysisAgent({
      role: { name: role.name },
      gaps: canonicalInput.gaps,
      toVerify: canonicalInput.toVerify,
      tutorStyle: canonicalInput.tutorStyle,
    });

    const sanitized = sanitizeAgentOutput(rawOutput, allowedRoleSlugs);
    agentExplanation = sanitized;

    // 13. Best-effort cache save
    try {
      await saveGapAnalysisCache(learner.id, inputHash, sanitized);
    } catch (cacheWriteError) {
      console.warn('Failed to save gap analysis cache:', cacheWriteError);
    }
  } catch (agentError) {
    console.warn('Gap Analysis Agent execution failed; falling back to deterministic result:', agentError);
    agentExplanation = null;
  }

  return {
    summary,
    gaps,
    topPriorities,
    unverified,
    agentExplanation,
  };
}
