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

/**
 * Updates the status of an objective by ID.
 */
export async function updateObjectiveStatus(
  objectiveId: string,
  status: 'active' | 'done' | 'dropped'
): Promise<ObjectiveRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('objectives')
    .update({ status })
    .eq('id', objectiveId)
    .select(`
      *,
      skill:skills(id, slug, name)
    `)
    .single();

  if (error || !data) {
    throw new Error(`Failed to update objective status for objective "${objectiveId}": ${error?.message}`);
  }

  return data as unknown as ObjectiveRecord;
}

/**
 * Updates status of all active objectives for a learner and specific skill (e.g. mark done or dropped).
 */
export async function updateObjectivesStatusByLearnerAndSkill(
  learnerId: string,
  skillId: string,
  status: 'active' | 'done' | 'dropped'
): Promise<void> {
  const db = getDbClient();
  const { error } = await db
    .from('objectives')
    .update({ status })
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .eq('status', 'active');

  if (error) {
    throw new Error(
      `Failed to update objective statuses for learner "${learnerId}", skill "${skillId}": ${error.message}`
    );
  }
}


