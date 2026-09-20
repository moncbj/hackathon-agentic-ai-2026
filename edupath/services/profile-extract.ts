// services/profile-extract.ts
// Orchestration for CV/document analysis via Profile Agent (SPEC-001)

import { getRoleById } from '@/lib/db/repositories/roles';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { runProfileAgent } from '@/agents/profile/run';

export class ProfileExtractError extends Error {
  constructor(
    message: string,
    public readonly code: 'ROLE_NOT_FOUND' | 'ROLE_NO_SKILLS' | 'AI_ERROR' | 'INVALID_INPUT',
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ProfileExtractError';
  }
}

export interface ExtractProfileInput {
  documentText: string;
  targetRoleId: string;
}

export interface EnrichedProposedSkill {
  skillSlug: string;
  skillName: string;
  proposedLevel: number;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface ExtractProfileResult {
  proposedSkills: EnrichedProposedSkill[];
  unmappedSkills: Array<{
    name: string;
    proposedLevel: number;
    rationale: string;
  }>;
  summary: string;
}

const MAX_DOCUMENT_CHARS = 20000;

/**
 * Orchestrates CV text analysis against the target role skills.
 *
 * Rules:
 * - Exactly one LLM call
 * - Truncates text to 20,000 characters
 * - Unknown skill slugs from agent output are silently filtered out
 * - Never persists CV text or writes to database
 */
export async function extractProfile(
  input: ExtractProfileInput,
): Promise<ExtractProfileResult> {
  if (!input.documentText || typeof input.documentText !== 'string') {
    throw new ProfileExtractError('Document text is required', 'INVALID_INPUT', 400);
  }

  // 1. Verify role exists
  const role = await getRoleById(input.targetRoleId);
  if (!role) {
    throw new ProfileExtractError('Role not found', 'ROLE_NOT_FOUND', 404);
  }

  // 2. Fetch role skills
  const roleSkills = await getSkillsByRole(role.id);
  if (roleSkills.length === 0) {
    throw new ProfileExtractError('Selected role has no skills', 'ROLE_NO_SKILLS', 400);
  }

  // 3. Truncate document text to reasonable token limit
  const truncatedText = input.documentText.slice(0, MAX_DOCUMENT_CHARS);

  // 4. Invoke Profile Agent
  let agentOutput;
  try {
    agentOutput = await runProfileAgent({
      documentText: truncatedText,
      roleSkills: roleSkills.map((s) => ({ slug: s.slug, name: s.name })),
    });
  } catch (err) {
    throw new ProfileExtractError(
      'AI extraction failed. Continue manually.',
      'AI_ERROR',
      502,
      err instanceof Error ? err.message : String(err)
    );
  }

  // 5. Filter unknown slugs and enrich with skill names
  const roleSkillMap = new Map(roleSkills.map((s) => [s.slug, s.name]));

  const filteredAndEnriched: EnrichedProposedSkill[] = [];
  for (const proposed of agentOutput.proposedSkills) {
    const skillName = roleSkillMap.get(proposed.skillSlug);
    if (skillName) {
      filteredAndEnriched.push({
        skillSlug: proposed.skillSlug,
        skillName,
        proposedLevel: proposed.proposedLevel,
        rationale: proposed.rationale,
        confidence: proposed.confidence,
      });
    }
  }

  return {
    proposedSkills: filteredAndEnriched,
    unmappedSkills: agentOutput.unmappedSkills,
    summary: agentOutput.summary,
  };
}
