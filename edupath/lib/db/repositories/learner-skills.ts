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

/**
 * Updates progress and status for a specific learner skill.
 */
export async function updateLearnerSkillProgress(
  learnerId: string,
  skillId: string,
  progress: number,
  status?: SkillStatus
): Promise<LearnerSkillRecord> {
  const db = getDbClient();
  const updatePayload: { progress: number; updated_at: string; status?: SkillStatus } = {
    progress,
    updated_at: new Date().toISOString(),
  };
  if (status) {
    updatePayload.status = status;
  }

  const { data, error } = await db
    .from('learner_skills')
    .update(updatePayload)
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update learner skill progress for learner "${learnerId}", skill "${skillId}": ${error?.message}`
    );
  }

  return data;
}

export interface UpdateLearnerSkillFullInput {
  level: number;
  verification: Verification;
  status: SkillStatus;
  progress: number;
  consecutiveFailures: number;
}

/**
 * Updates all assessment-derived fields for a specific learner skill.
 */
export async function updateLearnerSkillFull(
  learnerId: string,
  skillId: string,
  updates: UpdateLearnerSkillFullInput
): Promise<LearnerSkillRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('learner_skills')
    .update({
      level: updates.level,
      verification: updates.verification,
      status: updates.status,
      progress: updates.progress,
      consecutive_failures: updates.consecutiveFailures,
      updated_at: new Date().toISOString(),
    })
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update learner skill state for learner "${learnerId}", skill "${skillId}": ${error?.message}`
    );
  }

  return data;
}

/**
 * Bulk updates the statuses of learner skills (e.g. during recomputeStatuses).
 */
export async function bulkUpdateLearnerSkillStatuses(
  learnerId: string,
  statusUpdates: Array<{ skillId: string; status: SkillStatus }>
): Promise<void> {
  if (statusUpdates.length === 0) {
    return;
  }

  const db = getDbClient();
  const now = new Date().toISOString();

  for (const item of statusUpdates) {
    const { error } = await db
      .from('learner_skills')
      .update({
        status: item.status,
        updated_at: now,
      })
      .eq('learner_id', learnerId)
      .eq('skill_id', item.skillId);

    if (error) {
      throw new Error(
        `Failed to update status for learner "${learnerId}", skill "${item.skillId}": ${error.message}`
      );
    }
  }
}

/**
 * Fetches a single skill state for a learner.
 */
export async function getLearnerSkill(
  learnerId: string,
  skillId: string
): Promise<LearnerSkillRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('learner_skills')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch learner skill for learner "${learnerId}", skill "${skillId}": ${error.message}`
    );
  }

  return data;
}


