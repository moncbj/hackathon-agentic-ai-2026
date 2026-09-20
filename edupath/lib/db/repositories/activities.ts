import { getDbClient } from '../client';
import { ResourceRecord } from './resources';

export type ActivityType = 'resource' | 'practice' | 'project';
export type ActivityStatus = 'pending' | 'done' | 'skipped';

export interface ActivityRecord {
  id: string;
  journey_id: string;
  objective_id: string;
  skill_id: string;
  week: number;
  type: ActivityType;
  title: string;
  mission: string;
  instructions: string;
  success_criteria: string;
  resource_id: string | null;
  estimated_minutes: number;
  status: ActivityStatus;
  completed_at: string | null;
  created_at: string;
}

export interface ActivityWithDetails extends ActivityRecord {
  resource?: ResourceRecord | null;
  skill?: { id: string; slug: string; name: string } | null;
}

export interface CreateActivityInput {
  journeyId: string;
  objectiveId: string;
  skillId: string;
  week: number;
  type: ActivityType;
  title: string;
  mission: string;
  instructions: string;
  successCriteria: string;
  resourceId?: string | null;
  estimatedMinutes: number;
  status?: ActivityStatus;
}

/**
 * Creates activities in bulk for a journey.
 */
export async function createActivities(
  activities: CreateActivityInput[]
): Promise<ActivityRecord[]> {
  if (activities.length === 0) {
    return [];
  }

  const db = getDbClient();
  const rows = activities.map((act) => ({
    journey_id: act.journeyId,
    objective_id: act.objectiveId,
    skill_id: act.skillId,
    week: act.week,
    type: act.type,
    title: act.title,
    mission: act.mission,
    instructions: act.instructions,
    success_criteria: act.successCriteria,
    resource_id: act.resourceId ?? null,
    estimated_minutes: act.estimatedMinutes,
    status: act.status ?? 'pending',
  }));

  const { data, error } = await db
    .from('activities')
    .insert(rows)
    .select();

  if (error) {
    throw new Error(`Failed to create activities: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Retrieves all activities for a journey, ordered by week and creation.
 */
export async function getActivitiesByJourney(journeyId: string): Promise<ActivityRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('activities')
    .select('*')
    .eq('journey_id', journeyId)
    .order('week', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch activities for journey "${journeyId}": ${error.message}`);
  }

  return data ?? [];
}

/**
 * Retrieves all activities with joined resource and skill details for a journey.
 */
export async function getActivitiesWithDetailsByJourney(
  journeyId: string
): Promise<ActivityWithDetails[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('activities')
    .select(`
      *,
      resource:resources(*),
      skill:skills(id, slug, name)
    `)
    .eq('journey_id', journeyId)
    .order('week', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch activities with details for journey "${journeyId}": ${error.message}`);
  }

  return (data as unknown as ActivityWithDetails[]) ?? [];
}

/**
 * Retrieves a single activity by ID.
 */
export async function getActivityById(id: string): Promise<ActivityRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('activities')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch activity by ID "${id}": ${error.message}`);
  }

  return data;
}

/**
 * Updates status and completion timestamp of an activity.
 */
export async function updateActivityStatus(
  id: string,
  status: ActivityStatus,
  completedAt?: string | null
): Promise<ActivityRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('activities')
    .update({
      status,
      completed_at: completedAt !== undefined ? completedAt : (status === 'done' ? new Date().toISOString() : null),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update activity status for "${id}": ${error?.message}`);
  }

  return data;
}

/**
 * Counts how many activities have been skipped in a journey.
 */
export async function getSkippedActivitiesCount(journeyId: string): Promise<number> {
  const db = getDbClient();
  const { count, error } = await db
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('journey_id', journeyId)
    .eq('status', 'skipped');

  if (error) {
    throw new Error(`Failed to count skipped activities for journey "${journeyId}": ${error.message}`);
  }

  return count ?? 0;
}
