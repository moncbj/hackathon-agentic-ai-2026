import { getDbClient } from '../client';

export interface ObjectiveRecord {
  id: string;
  learner_id: string;
  skill_id: string;
  description: string;
  mastery_criteria: string[];
  target_level: number;
  status: 'active' | 'done' | 'dropped';
  created_at: string;
  skill?: {
    id?: string;
    slug?: string;
    name?: string;
  } | null;
}

export interface CreateObjectiveInput {
  skillId: string;
  description: string;
  masteryCriteria: string[];
  targetLevel: number;
  status?: 'active' | 'done' | 'dropped';
}

/**
 * Creates objectives in bulk for a learner.
 */
export async function createObjectives(
  learnerId: string,
  objectives: CreateObjectiveInput[]
): Promise<ObjectiveRecord[]> {
  if (objectives.length === 0) {
    return [];
  }

  const db = getDbClient();
  const rows = objectives.map((obj) => ({
    learner_id: learnerId,
    skill_id: obj.skillId,
    description: obj.description,
    mastery_criteria: obj.masteryCriteria,
    target_level: obj.targetLevel,
    status: obj.status ?? 'active',
  }));

  const { data, error } = await db
    .from('objectives')
    .insert(rows)
    .select();

  if (error) {
    throw new Error(`Failed to create objectives: ${error.message}`);
  }

  return (data as unknown as ObjectiveRecord[]) ?? [];
}

/**
 * Fetches all objectives for a learner.
 */
export async function getObjectivesByLearner(learnerId: string): Promise<ObjectiveRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('objectives')
    .select(`
      *,
      skill:skills(id, slug, name)
    `)
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch objectives for learner "${learnerId}": ${error.message}`);
  }

  return (data as unknown as ObjectiveRecord[]) ?? [];
}

/**
 * Fetches active objectives for a learner.
 */
export async function getActiveObjectives(learnerId: string): Promise<ObjectiveRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('objectives')
    .select(`
      *,
      skill:skills(id, slug, name)
    `)
    .eq('learner_id', learnerId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch active objectives for learner "${learnerId}": ${error.message}`);
  }

  return (data as unknown as ObjectiveRecord[]) ?? [];
}

