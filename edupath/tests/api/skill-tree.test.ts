// tests/api/skill-tree.test.ts
// Integration tests for GET /api/skill-tree endpoint (SPEC-002)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/skill-tree/route';
import * as skillTreeService from '@/services/skill-tree';

describe('API: GET /api/skill-tree', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with full deterministic nodes and edges on happy path', async () => {
    const mockTreeResponse: skillTreeService.SkillTreeResponse = {
      nodes: [
        {
          id: 'skill-1',
          slug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
          requiredLevel: 3,
          gap: 0,
          weight: 4,
          verification: 'self_reported',
          status: 'acquired',
          progress: 0,
          needsVerification: true,
          depth: 0,
        },
        {
          id: 'skill-2',
          slug: 'sql',
          name: 'SQL',
          level: 1,
          requiredLevel: 3,
          gap: 2,
          weight: 5,
          verification: 'self_reported',
          status: 'in_progress',
          progress: 10,
          needsVerification: false,
          depth: 1,
        },
      ],
      edges: [
        {
          source: 'skill-1',
          target: 'skill-2',
        },
      ],
    };

    vi.spyOn(skillTreeService, 'getSkillTreeData').mockResolvedValue(mockTreeResponse);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.nodes).toHaveLength(2);
    expect(body.nodes[0].slug).toBe('spreadsheets');
    expect(body.nodes[0].needsVerification).toBe(true);
    expect(body.nodes[1].slug).toBe('sql');
    expect(body.nodes[1].gap).toBe(2);

    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toEqual({
      source: 'skill-1',
      target: 'skill-2',
    });
  });

  it('returns 404 when no active learner is found', async () => {
    vi.spyOn(skillTreeService, 'getSkillTreeData').mockRejectedValue(
      new skillTreeService.SkillTreeError('No active learner profile found', 'NO_LEARNER', 404)
    );

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.code).toBe('NO_LEARNER');
    expect(body.error).toContain('No active learner');
  });

  it('returns 400 when active learner has no target role', async () => {
    vi.spyOn(skillTreeService, 'getSkillTreeData').mockRejectedValue(
      new skillTreeService.SkillTreeError('Active learner has no target role specified', 'NO_TARGET_ROLE', 400)
    );

    const response = await GET();
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('NO_TARGET_ROLE');
  });

  it('returns 404 when target role is not found in database', async () => {
    vi.spyOn(skillTreeService, 'getSkillTreeData').mockRejectedValue(
      new skillTreeService.SkillTreeError('Target role not found', 'ROLE_NOT_FOUND', 404)
    );

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.code).toBe('ROLE_NOT_FOUND');
  });

  it('returns 500 when unexpected error occurs', async () => {
    vi.spyOn(skillTreeService, 'getSkillTreeData').mockRejectedValue(
      new Error('Unexpected database failure')
    );

    const response = await GET();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to retrieve skill tree data');
  });
});
