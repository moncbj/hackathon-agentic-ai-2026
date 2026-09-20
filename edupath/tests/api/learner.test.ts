import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/route';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as skillsRepo from '@/lib/db/repositories/skills';

describe('API: GET /api/learner', () => {
  const mockLearnerId = '22222222-2222-2222-2222-222222222222';
  const mockRoleId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with full learner profile when an active learner exists', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue({
      id: mockLearnerId,
      name: 'Ana García',
      target_role_id: mockRoleId,
      background: 'Estudiante',
      weekly_hours: 10,
      extra_skills: [{ name: 'Git', level: 2 }],
      created_at: '2026-09-19T00:00:00Z',
    });

    vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue({
      learner_id: mockLearnerId,
      language: 'es',
      tone: 'cercano',
      detail_level: 'equilibrado',
      use_analogies: true,
      free_instructions: 'Explícamelo simple',
      created_at: '2026-09-19T00:00:00Z',
    });

    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([
      {
        learner_id: mockLearnerId,
        skill_id: 'skill-1',
        level: 2,
        verification: 'self_reported',
        status: 'available',
        progress: 0,
        consecutive_failures: 0,
        updated_at: '2026-09-19T00:00:00Z',
        created_at: '2026-09-19T00:00:00Z',
      },
    ]);

    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue([
      {
        id: 'skill-1',
        slug: 'sql',
        name: 'SQL',
        description: 'SQL queries',
        category: 'Data Management',
        created_at: '2026-01-01',
        required_level: 3,
        weight: 1,
      },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.learner.id).toBe(mockLearnerId);
    expect(body.learner.name).toBe('Ana García');
    expect(body.tutorStyle.tone).toBe('cercano');
    expect(body.skillStates).toHaveLength(1);
    expect(body.skillStates[0].skillSlug).toBe('sql');
    expect(body.skillStates[0].skillName).toBe('SQL');
    expect(body.skillStates[0].requiredLevel).toBe(3);
    expect(body.skillStates[0].level).toBe(2);
    expect(body.skillStates[0].status).toBe('available');
  });

  it('returns 404 when no learner exists', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toContain('No learner profile found');
  });

  it('returns 500 when repository throws', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockRejectedValue(new Error('DB read error'));

    const response = await GET();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to fetch learner profile');
  });
});
