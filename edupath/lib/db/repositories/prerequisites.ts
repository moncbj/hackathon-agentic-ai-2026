// lib/db/repositories/prerequisites.ts
// Repository for querying skill prerequisite relationships (SPEC-000, SPEC-001, SPEC-002)

import { getDbClient } from '../client';

export interface PrerequisiteRecord {
  skillId: string;
  prerequisiteSkillId: string;
}

/**
 * Retrieves prerequisite links for a specified list of skill IDs.
 */
export async function getPrerequisitesForSkills(skillIds: string[]): Promise<PrerequisiteRecord[]> {
  if (skillIds.length === 0) {
    return [];
  }

  const db = getDbClient();
  const { data, error } = await db
    .from('skill_prerequisites')
    .select('skill_id, prerequisite_skill_id')
    .in('skill_id', skillIds);

  if (error) {
    throw new Error(`Failed to fetch skill prerequisites: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    skillId: row.skill_id,
    prerequisiteSkillId: row.prerequisite_skill_id,
  }));
}

/**
 * Retrieves all prerequisite links for skills belonging to a specified role.
 */
export async function getPrerequisitesByRole(roleId: string): Promise<PrerequisiteRecord[]> {
  const db = getDbClient();
  const { data: roleSkills, error: roleError } = await db
    .from('role_skills')
    .select('skill_id')
    .eq('role_id', roleId);

  if (roleError) {
    throw new Error(`Failed to fetch role skills for prerequisites: ${roleError.message}`);
  }

  const skillIds = (roleSkills ?? []).map((r) => r.skill_id);
  return getPrerequisitesForSkills(skillIds);
}
