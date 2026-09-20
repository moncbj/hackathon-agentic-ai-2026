import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOnboarding, OnboardingError } from '@/services/onboarding';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';

describe('services/onboarding', () => {
  const mockRoleId = '11111111-1111-1111-1111-111111111111';
  const mockLearnerId = '22222222-2222-2222-2222-222222222222';

  const sampleRoleSkills = [
    {
      id: 'skill-1',
      slug: 'sql',
      name: 'SQL',
      description: 'SQL desc',
      category: 'Data',
      created_at: '2026-01-01',
      required_level: 3,
      weight: 1,
    },
    {
      id: 'skill-2',
      slug: 'spreadsheets',
      name: 'Spreadsheets',
      description: 'Excel desc',
      category: 'Data',
      created_at: '2026-01-01',
      required_level: 3,
      weight: 1,
    },
  ];

  const validInput = {
    name: 'Carlos Ruiz',
    background: 'Estudiante de ingeniería',
    targetRoleId: mockRoleId,
    weeklyHours: 15,
    declaredLevels: { sql: 2, spreadsheets: 3 },
    extraSkills: [{ name: 'Git', level: 2 }],
    tutorStyle: {
      language: 'es',
      tone: 'motivador' as const,
      detailLevel: 'equilibrado' as const,
      useAnalogies: true,
      freeInstructions: 'Usa ejemplos prácticos',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: creates learner, tutor style, and computed skill states', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Junior Data Analyst',
      description: 'Role desc',
      created_at: '2026-01-01',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(sampleRoleSkills);
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);

    const createLearnerSpy = vi.spyOn(learnersRepo, 'createLearner').mockResolvedValue({
      id: mockLearnerId,
      name: validInput.name,
      target_role_id: mockRoleId,
      background: validInput.background,
      weekly_hours: validInput.weeklyHours,
      extra_skills: validInput.extraSkills,
      created_at: '2026-01-01T00:00:00Z',
    });

    const createTutorStyleSpy = vi.spyOn(tutorStylesRepo, 'createTutorStyle').mockResolvedValue({
      learner_id: mockLearnerId,
      language: 'es',
      tone: 'motivador',
      detail_level: 'equilibrado',
      use_analogies: true,
      free_instructions: 'Usa ejemplos prácticos',
      created_at: '2026-01-01T00:00:00Z',
    });

    const createLearnerSkillsSpy = vi.spyOn(learnerSkillsRepo, 'createLearnerSkills').mockResolvedValue();

    const result = await createOnboarding(validInput);

    expect(result.learner.id).toBe(mockLearnerId);
    expect(result.learner.name).toBe('Carlos Ruiz');
    expect(result.tutorStyle.tone).toBe('motivador');
    expect(result.skillStates).toHaveLength(2);

    expect(createLearnerSpy).toHaveBeenCalledWith({
      name: 'Carlos Ruiz',
      targetRoleId: mockRoleId,
      background: 'Estudiante de ingeniería',
      weeklyHours: 15,
      extraSkills: [{ name: 'Git', level: 2 }],
    });
    expect(createTutorStyleSpy).toHaveBeenCalled();
    expect(createLearnerSkillsSpy).toHaveBeenCalled();

    // Verify computed states
    const sqlState = result.skillStates.find((s) => s.skillSlug === 'sql')!;
    expect(sqlState.level).toBe(2);
    expect(sqlState.status).toBe('available'); // declared 2 < required 3, no prereqs

    const sheetState = result.skillStates.find((s) => s.skillSlug === 'spreadsheets')!;
    expect(sheetState.level).toBe(3);
    expect(sheetState.status).toBe('acquired'); // declared 3 >= required 3
  });

  it('throws 409 LEARNER_EXISTS when an active learner already exists', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue({
      id: 'existing-id',
      name: 'Existing',
      target_role_id: mockRoleId,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: '2026-01-01',
    });

    await expect(createOnboarding(validInput)).rejects.toThrowError(OnboardingError);
    await expect(createOnboarding(validInput)).rejects.toMatchObject({
      code: 'LEARNER_EXISTS',
      status: 409,
    });
  });

  it('throws 404 ROLE_NOT_FOUND when targetRoleId does not exist', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(null);

    await expect(createOnboarding(validInput)).rejects.toMatchObject({
      code: 'ROLE_NOT_FOUND',
      status: 404,
    });
  });

  it('performs compensating rollback (deleteLearner) when createTutorStyle fails', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Role',
      description: '',
      created_at: '',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(sampleRoleSkills);
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);

    vi.spyOn(learnersRepo, 'createLearner').mockResolvedValue({
      id: mockLearnerId,
      name: validInput.name,
      target_role_id: mockRoleId,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: '',
    });

    // tutor style creation fails
    vi.spyOn(tutorStylesRepo, 'createTutorStyle').mockRejectedValue(new Error('Tutor insert failed'));

    const deleteLearnerSpy = vi.spyOn(learnersRepo, 'deleteLearner').mockResolvedValue();

    await expect(createOnboarding(validInput)).rejects.toThrowError('Failed to create learner profile');

    // Rollback MUST have deleted the created learner
    expect(deleteLearnerSpy).toHaveBeenCalledWith(mockLearnerId);
  });

  it('performs compensating rollback (deleteLearner) when createLearnerSkills fails', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Role',
      description: '',
      created_at: '',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(sampleRoleSkills);
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);

    vi.spyOn(learnersRepo, 'createLearner').mockResolvedValue({
      id: mockLearnerId,
      name: validInput.name,
      target_role_id: mockRoleId,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: '',
    });

    vi.spyOn(tutorStylesRepo, 'createTutorStyle').mockResolvedValue({
      learner_id: mockLearnerId,
      language: 'es',
      tone: 'cercano',
      detail_level: 'equilibrado',
      use_analogies: true,
      free_instructions: '',
      created_at: '',
    });

    // skill insertion fails
    vi.spyOn(learnerSkillsRepo, 'createLearnerSkills').mockRejectedValue(new Error('Skill bulk insert failed'));

    const deleteLearnerSpy = vi.spyOn(learnersRepo, 'deleteLearner').mockResolvedValue();

    await expect(createOnboarding(validInput)).rejects.toThrowError('Failed to create learner profile');

    // Rollback MUST have deleted the created learner
    expect(deleteLearnerSpy).toHaveBeenCalledWith(mockLearnerId);
  });

  it('re-throws original error even if deleteLearner fails during rollback', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Role',
      description: '',
      created_at: '',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(sampleRoleSkills);
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);

    vi.spyOn(learnersRepo, 'createLearner').mockResolvedValue({
      id: mockLearnerId,
      name: validInput.name,
      target_role_id: mockRoleId,
      background: '',
      weekly_hours: 10,
      extra_skills: [],
      created_at: '',
    });

    vi.spyOn(tutorStylesRepo, 'createTutorStyle').mockRejectedValue(new Error('DB failure'));
    // deleteLearner also fails
    vi.spyOn(learnersRepo, 'deleteLearner').mockRejectedValue(new Error('Rollback DB network drop'));

    // Original application error must still be propagated
    await expect(createOnboarding(validInput)).rejects.toMatchObject({
      code: 'DB_ERROR',
      status: 500,
    });
  });
});
