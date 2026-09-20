import { getDbClient } from '../client';

export interface ResourceRecord {
  id: string;
  skill_id: string;
  title: string;
  url: string;
  type: string;
  level_min: number;
  level_max: number;
  language: string;
  verified: boolean;
  created_at: string;
}

/**
 * Fetches resources for the specified list of skill IDs.
 */
export async function getResourcesForSkills(skillIds: string[]): Promise<ResourceRecord[]> {
  if (skillIds.length === 0) {
    return [];
  }

  const db = getDbClient();
  const { data, error } = await db
    .from('resources')
    .select('*')
    .in('skill_id', skillIds);

  if (error) {
    throw new Error(`Failed to fetch resources: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetches all available resources.
 */
export async function getAllResources(): Promise<ResourceRecord[]> {
  const db = getDbClient();
  const { data, error } = await db.from('resources').select('*');

  if (error) {
    throw new Error(`Failed to fetch all resources: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetches a single resource by ID.
 */
export async function getResourceById(id: string): Promise<ResourceRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('resources')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch resource by ID "${id}": ${error.message}`);
  }

  return data;
}
