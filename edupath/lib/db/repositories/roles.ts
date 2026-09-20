import { getDbClient } from '../client';

export interface RoleRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
}

export async function getRoles(): Promise<RoleRecord[]> {
  const db = getDbClient();
  const { data, error } = await db.from('roles').select('*').order('name');
  if (error) {
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }
  return data ?? [];
}

export async function getRoleBySlug(slug: string): Promise<RoleRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('roles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch role with slug "${slug}": ${error.message}`);
  }
  return data;
}

export async function countSeededRoles(): Promise<number> {
  const db = getDbClient();
  const { count, error } = await db
    .from('roles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count roles: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Returns the seeded catalog names for operational UI. Keeping this separate
 * from the count makes the health payload useful to the frontend without
 * exposing any learner data.
 */
export async function getSeededRoleNames(): Promise<string[]> {
  const db = getDbClient();
  const { data, error } = await db.from('roles').select('name').order('name');

  if (error) {
    throw new Error(`Failed to fetch seeded role names: ${error.message}`);
  }

  return (data ?? []).map((role) => role.name);
}

export async function getRoleById(id: string): Promise<RoleRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('roles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch role with id "${id}": ${error.message}`);
  }
  return data;
}

