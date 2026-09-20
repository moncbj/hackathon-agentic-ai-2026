// tests/services/skill-tree.test.ts
// Unit tests for Skill Tree Service (SPEC-002)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSkillTreeData, SkillTreeError } from '@/services/skill-tree';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';

describe('services/skill-tree - getSkillTreeData', () => {
  const mockLearnerId = 'learner-123';
  const mockRoleId = 'role-123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws 404 NO_LEARNER if no active learner exists', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);

    await expect(getSkillTreeData()).rejects.toThrow(SkillTreeError);
    await expect(getSkillTreeData()).rejects.toMatchObject({
      code: 'NO_LEARNER',
      status: 404,
    });
  });

  it('throws 400 NO_TARGET_ROLE if learner has no target role', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue({
      id: mockLearnerId,
      name: 'Test Learner',
      target_role_id: null,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: new Date().toISOString(),
    });

    await expect(getSkillTreeData()).rejects.toMatchObject({
      code: 'NO_TARGET_ROLE',
      status: 400,
    });
  });

  it('throws 404 ROLE_NOT_FOUND if target role does not exist', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue({
      id: mockLearnerId,
      name: 'Test Learner',
      target_role_id: mockRoleId,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: new Date().toISOString(),
    });
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(null);

    await expect(getSkillTreeData()).rejects.toMatchObject({
      code: 'ROLE_NOT_FOUND',
      status: 404,
    });
  });

  it('assembles skill tree nodes and edges with deterministic mapping and ordering', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue({
      id: mockLearnerId,
      name: 'Test Learner',
      target_role_id: mockRoleId,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: new Date().toISOString(),
    });
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Data Analyst',
      description: 'Role desc',
      created_at: new Date().toISOString(),
    });

    const mockRoleSkills = [
      {
        id: 'skill-b',
        slug: 'sql',
        name: 'SQL',
        description: 'SQL desc',
        category: 'Data',
        created_at: '2026-01-01',
        required_level: 3,
        weight: 5,
      },
      {
        id: 'skill-a',
        slug: 'spreadsheets',
        name: 'Spreadsheets',
        description: 'Sheets desc',
        category: 'Data',
        created_at: '2026-01-01',
        required_level: 3,
        weight: 4,
      },
    ];
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);

    const mockLearnerSkills = [
      {
        learner_id: mockLearnerId,
        skill_id: 'skill-a',
        level: 3,
        verification: 'self_reported' as const,
        status: 'acquired' as const,
        progress: 0,
        consecutive_failures: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        learner_id: mockLearnerId,
        skill_id: 'skill-b',
        level: 1,
        verification: 'self_reported' as const,
        status: 'in_progress' as const,
        progress: 25,
        consecutive_failures: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);

    // SQL (skill-b) requires Spreadsheets (skill-a)
    const mockPrerequisites = [
      { skillId: 'skill-b', prerequisiteSkillId: 'skill-a' },
      { skillId: 'skill-b', prerequisiteSkillId: 'skill-a' }, // Duplicate to test deduplication
    ];
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue(mockPrerequisites);

    const response = await getSkillTreeData();

    // Verify nodes
    expect(response.nodes).toHaveLength(2);

    // Node 0 should be Spreadsheets (depth 0), Node 1 should be SQL (depth 1)
    const nodeA = response.nodes[0];
    expect(nodeA.id).toBe('skill-a');
    expect(nodeA.slug).toBe('spreadsheets');
    expect(nodeA.level).toBe(3);
    expect(nodeA.requiredLevel).toBe(3);
    expect(nodeA.gap).toBe(0);
    expect(nodeA.depth).toBe(0);
    expect(nodeA.status).toBe('acquired');
    expect(nodeA.needsVerification).toBe(true); // weight 4 >= 4, gap 0, self_reported

    const nodeB = response.nodes[1];
    expect(nodeB.id).toBe('skill-b');
    expect(nodeB.slug).toBe('sql');
    expect(nodeB.level).toBe(1);
    expect(nodeB.requiredLevel).toBe(3);
    expect(nodeB.gap).toBe(2);
    expect(nodeB.depth).toBe(1);
    expect(nodeB.status).toBe('in_progress');
    expect(nodeB.progress).toBe(25);
    expect(nodeB.needsVerification).toBe(false);

    // Verify edges: source = prerequisite (skill-a), target = dependent (skill-b)
    expect(response.edges).toHaveLength(1); // Deduplicated!
    expect(response.edges[0]).toEqual({
      source: 'skill-a',
      target: 'skill-b',
    });
  });
});
