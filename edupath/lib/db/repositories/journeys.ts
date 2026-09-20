import { getDbClient } from '../client';

export type JourneyReason = 'initial' | 'assessment' | 'skipped_activities' | 'profile_change';

export interface JourneyRecord {
  id: string;
  learner_id: string;
  version: number;
  is_current: boolean;
  reason: JourneyReason;
  summary: string;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface CreateJourneyInput {
  learnerId: string;
  version?: number;
  isCurrent?: boolean;
  reason?: JourneyReason;
  summary?: string;
  changes?: Record<string, unknown>;
}

/**
 * Retrieves the currently active journey for a learner.
 */
export async function getActiveJourney(learnerId: string): Promise<JourneyRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('journeys')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('is_current', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active journey for learner "${learnerId}": ${error.message}`);
  }

  return data;
}

/**
 * Retrieves the latest journey by creation date for a learner.
 */
export async function getLatestJourney(learnerId: string): Promise<JourneyRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('journeys')
    .select('*')
    .eq('learner_id', learnerId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest journey for learner "${learnerId}": ${error.message}`);
  }

  return data;
}

/**
 * Retrieves all journeys for a learner.
 */
export async function getAllJourneysForLearner(learnerId: string): Promise<JourneyRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('journeys')
    .select('*')
    .eq('learner_id', learnerId)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch journeys for learner "${learnerId}": ${error.message}`);
  }

  return data ?? [];
}

/**
 * Deactivates all current journeys for a learner (sets is_current = false).
 */
export async function deactivateCurrentJourneys(learnerId: string): Promise<void> {
  const db = getDbClient();
  const { error } = await db
    .from('journeys')
    .update({ is_current: false })
    .eq('learner_id', learnerId)
    .eq('is_current', true);

  if (error) {
    throw new Error(`Failed to deactivate current journeys for learner "${learnerId}": ${error.message}`);
  }
}

/**
 * Creates a new journey record.
 */
export async function createJourney(input: CreateJourneyInput): Promise<JourneyRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('journeys')
    .insert({
      learner_id: input.learnerId,
      version: input.version ?? 1,
      is_current: input.isCurrent ?? true,
      reason: input.reason ?? 'initial',
      summary: input.summary ?? '',
      changes: input.changes ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create journey: ${error?.message}`);
  }

  return data;
}
