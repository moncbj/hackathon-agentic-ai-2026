import { getDbClient } from '../client';

export interface SkillRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
}

export interface RoleSkillRecord extends SkillRecord {
  required_level: number;
  weight: number;
}

export async function getSkills(): Promise<SkillRecord[]> {
  const db = getDbClient();
  const { data, error } = await db.from('skills').select('*').order('name');
  if (error) {
    throw new Error(`Failed to fetch skills: ${error.message}`);
  }
  return data ?? [];
}

export async function getSkillsByRole(roleId: string): Promise<RoleSkillRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('role_skills')
    .select(`
      required_level,
      weight,
      skills:skill_id (
        id,
        slug,
        name,
        description,
        category,
        created_at
      )
    `)
    .eq('role_id', roleId);

  if (error) {
    throw new Error(`Failed to fetch skills for role "${roleId}": ${error.message}`);
  }

  interface RoleSkillJoinRow {
    required_level: number;
    weight: number;
    skills: SkillRecord;
  }

  return (data as unknown as RoleSkillJoinRow[] ?? []).map((row) => ({
    id: row.skills.id,
    slug: row.skills.slug,
    name: row.skills.name,
    description: row.skills.description,
    category: row.skills.category,
    created_at: row.skills.created_at,
    required_level: row.required_level,
    weight: row.weight,
  }));
}
