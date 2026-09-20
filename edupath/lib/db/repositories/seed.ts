import { getDbClient } from '../client';
import { assertValidPrerequisites, PrerequisiteEdge } from '@/domain/validate-prerequisites';

export interface SeedRoleInput {
  slug: string;
  name: string;
  description: string;
}

export interface SeedSkillInput {
  slug: string;
  name: string;
  description: string;
  category: string;
}

export interface SeedRoleSkillInput {
  role_slug: string;
  skill_slug: string;
  required_level: number;
  weight: number;
}

export interface SeedPrerequisiteInput {
  skill_slug: string;
  prerequisite_skill_slug: string;
}

export interface SeedResourceInput {
  skill_slug: string;
  title: string;
  url: string;
  type: string;
  level_min: number;
  level_max: number;
  language: string;
  verified: boolean;
}

export interface SeedDataset {
  roles: SeedRoleInput[];
  skills: SeedSkillInput[];
  roleSkills: SeedRoleSkillInput[];
  prerequisites: SeedPrerequisiteInput[];
  resources: SeedResourceInput[];
}

/**
 * Clears all learner-created and demo-generated data in reverse foreign-key order.
 * Preserves foundational catalog data (roles, skills, resources, prerequisites).
 */
export async function clearLearnerData(): Promise<void> {
  const db = getDbClient();

  // Reverse dependency order
  const tables = [
    'notebook_skills',
    'notebooks',
    'reports',
    'gap_analyses',
    'assessments',
    'activities',
    'journeys',
    'objectives',
    'learner_skills',
    'tutor_styles',
    'learners',
  ];

  for (const table of tables) {
    const { error } = await db
      .from(table)
      .delete()
      .filter('created_at', 'gte', '1970-01-01T00:00:00Z');

    if (error) {
      throw new Error(`Failed to clear table "${table}": ${error.message}`);
    }
  }
}

/**
 * Idempotently loads the seed dataset into Supabase.
 * Validates prerequisite DAG before inserting any prerequisite relations.
 */
export async function runSeed(dataset: SeedDataset): Promise<{
  rolesCount: number;
  skillsCount: number;
  roleSkillsCount: number;
  prerequisitesCount: number;
  resourcesCount: number;
}> {
  const db = getDbClient();

  // 1. Upsert roles
  if (dataset.roles.length > 0) {
    const { error: rolesError } = await db
      .from('roles')
      .upsert(dataset.roles, { onConflict: 'slug' });
    if (rolesError) {
      throw new Error(`Failed to seed roles: ${rolesError.message}`);
    }
  }

  // 2. Upsert skills
  if (dataset.skills.length > 0) {
    const { error: skillsError } = await db
      .from('skills')
      .upsert(dataset.skills, { onConflict: 'slug' });
    if (skillsError) {
      throw new Error(`Failed to seed skills: ${skillsError.message}`);
    }
  }

  // Fetch roles and skills to obtain IDs mapped by slug
  const { data: dbRoles, error: fetchRolesError } = await db
    .from('roles')
    .select('id, slug');
  if (fetchRolesError || !dbRoles) {
    throw new Error(`Failed to query roles for ID mapping: ${fetchRolesError?.message}`);
  }

  const { data: dbSkills, error: fetchSkillsError } = await db
    .from('skills')
    .select('id, slug');
  if (fetchSkillsError || !dbSkills) {
    throw new Error(`Failed to query skills for ID mapping: ${fetchSkillsError?.message}`);
  }

  const roleMap = new Map<string, string>(dbRoles.map((r) => [r.slug, r.id]));
  const skillMap = new Map<string, string>(dbSkills.map((s) => [s.slug, s.id]));

  // 3. Validate prerequisites DAG BEFORE inserting
  const prerequisiteEdges: PrerequisiteEdge[] = dataset.prerequisites.map((p) => {
    const skillId = skillMap.get(p.skill_slug);
    const prereqId = skillMap.get(p.prerequisite_skill_slug);
    if (!skillId) {
      throw new Error(`Prerequisite references unknown skill slug: "${p.skill_slug}"`);
    }
    if (!prereqId) {
      throw new Error(
        `Prerequisite references unknown prerequisite skill slug: "${p.prerequisite_skill_slug}"`
      );
    }
    return {
      skill_id: skillId,
      prerequisite_skill_id: prereqId,
    };
  });

  // Pure graph cycle and self-reference validation
  assertValidPrerequisites(prerequisiteEdges);

  // Upsert skill prerequisites
  if (prerequisiteEdges.length > 0) {
    const { error: prereqsError } = await db
      .from('skill_prerequisites')
      .upsert(prerequisiteEdges, { onConflict: 'skill_id,prerequisite_skill_id' });
    if (prereqsError) {
      throw new Error(`Failed to seed skill prerequisites: ${prereqsError.message}`);
    }
  }

  // 4. Upsert role_skills
  const roleSkillRows = dataset.roleSkills.map((rs) => {
    const roleId = roleMap.get(rs.role_slug);
    const skillId = skillMap.get(rs.skill_slug);
    if (!roleId) {
      throw new Error(`Role-skill references unknown role slug: "${rs.role_slug}"`);
    }
    if (!skillId) {
      throw new Error(`Role-skill references unknown skill slug: "${rs.skill_slug}"`);
    }
    return {
      role_id: roleId,
      skill_id: skillId,
      required_level: rs.required_level,
      weight: rs.weight,
    };
  });

  if (roleSkillRows.length > 0) {
    const { error: roleSkillsError } = await db
      .from('role_skills')
      .upsert(roleSkillRows, { onConflict: 'role_id,skill_id' });
    if (roleSkillsError) {
      throw new Error(`Failed to seed role_skills: ${roleSkillsError.message}`);
    }
  }

  // 5. Upsert resources
  const resourceRows = dataset.resources.map((r) => {
    const skillId = skillMap.get(r.skill_slug);
    if (!skillId) {
      throw new Error(`Resource references unknown skill slug: "${r.skill_slug}"`);
    }
    return {
      skill_id: skillId,
      title: r.title,
      url: r.url,
      type: r.type,
      level_min: r.level_min,
      level_max: r.level_max,
      language: r.language,
      verified: r.verified,
    };
  });

  if (resourceRows.length > 0) {
    const { error: resourcesError } = await db
      .from('resources')
      .upsert(resourceRows, { onConflict: 'skill_id,url' });
    if (resourcesError) {
      throw new Error(`Failed to seed resources: ${resourcesError.message}`);
    }
  }

  return {
    rolesCount: dataset.roles.length,
    skillsCount: dataset.skills.length,
    roleSkillsCount: dataset.roleSkills.length,
    prerequisitesCount: dataset.prerequisites.length,
    resourcesCount: dataset.resources.length,
  };
}
