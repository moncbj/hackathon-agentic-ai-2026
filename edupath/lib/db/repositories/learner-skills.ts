import { getDbClient } from '../client';
import { SkillStatus, Verification } from '@/domain/constants';

export interface LearnerSkillRecord {
  learner_id: string;
  skill_id: string;
  level: number;
  verification: Verification;
  status: SkillStatus;
  progress: number;
  consecutive_failures: number;
  updated_at: string;
  created_at: string;
}

export interface LearnerSkillInsert {
  skillId: string;
  level: number;
  verification: Verification;
  status: SkillStatus;
  progress?: number;
  consecutiveFailures?: number;
}

/**
 * Bulk inserts skill states for a learner.
 */
export async function createLearnerSkills(
  learnerId: string,
  skills: LearnerSkillInsert[],
): Promise<void> {
  if (skills.length === 0) {
    return;
  }

  const db = getDbClient();
  const rows = skills.map((s) => ({
    learner_id: learnerId,
    skill_id: s.skillId,
    level: s.level,
    verification: s.verification,
    status: s.status,
    progress: s.progress ?? 0,
    consecutive_failures: s.consecutiveFailures ?? 0,
  }));

  const { error } = await db.from('learner_skills').insert(rows);

  if (error) {
    throw new Error(`Failed to create learner skills: ${error.message}`);
  }
}

/**
 * Retrieves all skill states for a given learner.
 */
export async function getLearnerSkills(learnerId: string): Promise<LearnerSkillRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('learner_skills')
    .select('*')
    .eq('learner_id', learnerId);

  if (error) {
    throw new Error(`Failed to fetch learner skills for learner "${learnerId}": ${error.message}`);
  }

  return data ?? [];
}
