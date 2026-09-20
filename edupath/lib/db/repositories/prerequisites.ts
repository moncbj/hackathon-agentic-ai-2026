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
