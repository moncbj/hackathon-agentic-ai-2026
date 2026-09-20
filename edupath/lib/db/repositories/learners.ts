import { getDbClient } from '../client';

export interface LearnerRecord {
  id: string;
  name: string;
  target_role_id: string | null;
  background: string;
  weekly_hours: number;
  extra_skills: Array<{ name: string; level: number }>;
  created_at: string;
}

/**
 * Returns the single active learner in the system (or null if none exists).
 * EduPath MVP operates as a single-learner system without multi-user auth.
 */
export async function getActiveLearner(): Promise<LearnerRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('learners')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active learner: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves a learner by specific ID.
 */
export async function getLearnerById(learnerId: string): Promise<LearnerRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('learners')
    .select('*')
    .eq('id', learnerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch learner "${learnerId}": ${error.message}`);
  }

  return data;
}

export interface LearnerInsert {
  name: string;
  targetRoleId: string;
  background: string;
  weeklyHours: number;
  extraSkills: Array<{ name: string; level: number }>;
}

/**
 * Creates a new learner record.
 */
export async function createLearner(input: LearnerInsert): Promise<LearnerRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('learners')
    .insert({
      name: input.name,
      target_role_id: input.targetRoleId,
      background: input.background,
      weekly_hours: input.weeklyHours,
      extra_skills: input.extraSkills,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create learner: ${error.message}`);
  }

  return data;
}

/**
 * Deletes a learner by ID.
 * Due to ON DELETE CASCADE on tutor_styles and learner_skills,
 * dependent rows are cleaned up automatically at the database level.
 */
export async function deleteLearner(learnerId: string): Promise<void> {
  const db = getDbClient();
  const { error } = await db
    .from('learners')
    .delete()
    .eq('id', learnerId);

  if (error) {
    throw new Error(`Failed to delete learner "${learnerId}": ${error.message}`);
  }
}

