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
