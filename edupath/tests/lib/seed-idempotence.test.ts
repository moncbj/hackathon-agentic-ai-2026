import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runSeed, SeedDataset } from '@/lib/db/repositories/seed';
import * as dbClientModule from '@/lib/db/client';
import { validatePrerequisites, assertValidPrerequisites } from '@/domain/validate-prerequisites';

describe('lib/db/repositories/seed (Idempotence and Safety)', () => {
  const seedDir = path.join(process.cwd(), 'data', 'seed');

  it('should have valid seed data files that parse correctly', () => {
    const roles = JSON.parse(fs.readFileSync(path.join(seedDir, 'roles.json'), 'utf-8'));
    const skills = JSON.parse(fs.readFileSync(path.join(seedDir, 'skills.json'), 'utf-8'));
    const roleSkills = JSON.parse(fs.readFileSync(path.join(seedDir, 'role-skills.json'), 'utf-8'));
    const prerequisites = JSON.parse(
      fs.readFileSync(path.join(seedDir, 'skill-prerequisites.json'), 'utf-8')
    );
    const resources = JSON.parse(
      fs.readFileSync(path.join(seedDir, 'resources.json'), 'utf-8')
    );

    expect(roles.length).toBe(1);
    expect(roles[0].slug).toBe('data-analyst-junior');
    expect(skills.length).toBeGreaterThanOrEqual(10);
    expect(skills.length).toBeLessThanOrEqual(14);
    expect(roleSkills.length).toBe(skills.length);
    expect(prerequisites.length).toBeGreaterThan(0);
    expect(resources.length).toBeGreaterThanOrEqual(skills.length * 2);
  });

  it('should validate the real seed prerequisites as a cycle-free DAG', () => {
    const prerequisites = JSON.parse(
      fs.readFileSync(path.join(seedDir, 'skill-prerequisites.json'), 'utf-8')
    );

    const edges = prerequisites.map((p: { skill_slug: string; prerequisite_skill_slug: string }) => ({
      skill_id: p.skill_slug,
      prerequisite_skill_id: p.prerequisite_skill_slug,
    }));

    const result = validatePrerequisites(edges);
    expect(result.valid).toBe(true);
    expect(() => assertValidPrerequisites(edges)).not.toThrow();
  });

  it('should abort and throw before database insertion if seed contains a cyclic prerequisite', async () => {
    const cyclicDataset: SeedDataset = {
      roles: [{ slug: 'test-role', name: 'Test', description: 'Test' }],
      skills: [
        { slug: 'a', name: 'Skill A', description: 'A', category: 'Cat' },
        { slug: 'b', name: 'Skill B', description: 'B', category: 'Cat' },
      ],
      roleSkills: [
        { role_slug: 'test-role', skill_slug: 'a', required_level: 1, weight: 1 },
      ],
      prerequisites: [
        { skill_slug: 'a', prerequisite_skill_slug: 'b' },
        { skill_slug: 'b', prerequisite_skill_slug: 'a' },
      ],
      resources: [],
    };

    // Mock DB client
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'roles') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'role-1', slug: 'test-role' }],
            error: null,
          }),
        };
      }
      if (table === 'skills') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockResolvedValue({
            data: [
              { id: 'skill-a-id', slug: 'a' },
              { id: 'skill-b-id', slug: 'b' },
            ],
            error: null,
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    vi.spyOn(dbClientModule, 'getDbClient').mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof dbClientModule.getDbClient>);

    await expect(runSeed(cyclicDataset)).rejects.toThrow(/Circular dependency cycle detected/);
  });

  it('should use upsert with correct onConflict keys across consecutive runs (idempotence)', async () => {
    const dataset: SeedDataset = {
      roles: [{ slug: 'data-analyst-junior', name: 'Data Analyst', description: 'Test' }],
      skills: [{ slug: 'sql', name: 'SQL', description: 'Querying', category: 'Data' }],
      roleSkills: [{ role_slug: 'data-analyst-junior', skill_slug: 'sql', required_level: 2, weight: 3 }],
      prerequisites: [],
      resources: [
        {
          skill_slug: 'sql',
          title: 'SQL Resource',
          url: 'https://example.com/sql',
          type: 'docs',
          level_min: 1,
          level_max: 2,
          language: 'en',
          verified: true,
        },
      ],
    };

    const upsertCalls: { table: string; onConflict: string }[] = [];

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      return {
        upsert: vi.fn().mockImplementation((_rows, options) => {
          upsertCalls.push({ table, onConflict: options?.onConflict });
          return Promise.resolve({ error: null });
        }),
        select: vi.fn().mockImplementation(() => {
          if (table === 'roles') {
            return Promise.resolve({ data: [{ id: 'role-uuid', slug: 'data-analyst-junior' }], error: null });
          }
          if (table === 'skills') {
            return Promise.resolve({ data: [{ id: 'skill-uuid', slug: 'sql' }], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      };
    });

    vi.spyOn(dbClientModule, 'getDbClient').mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof dbClientModule.getDbClient>);

    // Run 1
    const run1 = await runSeed(dataset);
    expect(run1.rolesCount).toBe(1);

    // Run 2 (second run with exact same data)
    const run2 = await runSeed(dataset);
    expect(run2.rolesCount).toBe(1);

    // Verify onConflict constraints were supplied on every upsert
    expect(upsertCalls.filter((c) => c.table === 'roles')).toEqual([
      { table: 'roles', onConflict: 'slug' },
      { table: 'roles', onConflict: 'slug' },
    ]);
    expect(upsertCalls.filter((c) => c.table === 'skills')).toEqual([
      { table: 'skills', onConflict: 'slug' },
      { table: 'skills', onConflict: 'slug' },
    ]);
    expect(upsertCalls.filter((c) => c.table === 'role_skills')).toEqual([
      { table: 'role_skills', onConflict: 'role_id,skill_id' },
      { table: 'role_skills', onConflict: 'role_id,skill_id' },
    ]);
    expect(upsertCalls.filter((c) => c.table === 'resources')).toEqual([
      { table: 'resources', onConflict: 'skill_id,url' },
      { table: 'resources', onConflict: 'skill_id,url' },
    ]);
  });
});
