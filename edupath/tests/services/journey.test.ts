// tests/services/journey.test.ts
// Unit and integration tests for Journey Service (SPEC-003)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateInitialJourney,
  getActiveJourneyData,
  completeActivity,
  skipActivity,
  JourneyServiceError,
} from '@/services/journey';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as resourcesRepo from '@/lib/db/repositories/resources';
import * as journeysRepo from '@/lib/db/repositories/journeys';
import * as objectivesRepo from '@/lib/db/repositories/objectives';
import * as activitiesRepo from '@/lib/db/repositories/activities';
import * as plannerRunner from '@/agents/planner/run';

describe('services/journey', () => {
  const mockLearnerId = 'learner-123';
  const mockRoleId = 'role-123';
  const mockJourneyId = 'journey-123';

  const mockLearner: learnersRepo.LearnerRecord = {
    id: mockLearnerId,
    name: 'Ana García',
    target_role_id: mockRoleId,
    background: 'Estudiante de ingeniería',
    weekly_hours: 5,
    extra_skills: [],
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockRole: rolesRepo.RoleRecord = {
    id: mockRoleId,
    slug: 'data-analyst-junior',
    name: 'Data Analyst (junior)',
    description: 'Role description',
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockRoleSkills = [
    {
      id: 'skill-sql',
      slug: 'sql',
      name: 'SQL',
      description: 'SQL desc',
      category: 'Data',
      created_at: '2026-01-01T00:00:00Z',
      required_level: 2,
      weight: 5,
    },
    {
      id: 'skill-sheets',
      slug: 'spreadsheets',
      name: 'Spreadsheets',
      description: 'Sheets desc',
      category: 'Data',
      created_at: '2026-01-01T00:00:00Z',
      required_level: 2,
      weight: 3,
    },
  ];

  const mockLearnerSkills = [
    {
      learner_id: mockLearnerId,
      skill_id: 'skill-sql',
      level: 1,
      verification: 'self_reported' as const,
      status: 'available' as const,
      progress: 0,
      consecutive_failures: 0,
      updated_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      learner_id: mockLearnerId,
      skill_id: 'skill-sheets',
      level: 1,
      verification: 'self_reported' as const,
      status: 'available' as const,
      progress: 0,
      consecutive_failures: 0,
      updated_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockResources = [
    {
      id: 'res-sql-1',
      skill_id: 'skill-sql',
      title: 'SQL Tutorial',
      url: 'https://example.com/sql',
      type: 'course',
      level_min: 0,
      level_max: 2,
      language: 'es',
      verified: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockTutorStyle = {
    learner_id: mockLearnerId,
    language: 'es',
    tone: 'cercano' as const,
    detail_level: 'equilibrado' as const,
    use_analogies: true,
    free_instructions: 'Usar analogías de cocina',
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockJourneyRecord = {
    id: mockJourneyId,
    learner_id: mockLearnerId,
    version: 1,
    is_current: true,
    reason: 'initial' as const,
    summary: 'Plan inicial',
    changes: {},
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateInitialJourney', () => {
    it('successfully generates and persists an initial journey with at most 1 AI call', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(resourcesRepo, 'getResourcesForSkills').mockResolvedValue(mockResources);
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValueOnce(null).mockResolvedValue(mockJourneyRecord);
      vi.spyOn(journeysRepo, 'getAllJourneysForLearner').mockResolvedValue([]);
      vi.spyOn(journeysRepo, 'createJourney').mockResolvedValue(mockJourneyRecord);

      vi.spyOn(objectivesRepo, 'createObjectives').mockResolvedValue([
        {
          id: 'obj-sql',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Dominar SQL',
          mastery_criteria: ['Completar ejercicios'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.spyOn(objectivesRepo, 'getObjectivesByLearner').mockResolvedValue([
        {
          id: 'obj-sql',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Dominar SQL',
          mastery_criteria: ['Completar ejercicios'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      vi.spyOn(activitiesRepo, 'createActivities').mockResolvedValue([]);
      vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockResolvedValue([
        {
          id: 'act-1',
          journey_id: mockJourneyId,
          objective_id: 'obj-sql',
          skill_id: 'skill-sql',
          week: 1,
          type: 'resource',
          title: 'Aprender SQL',
          mission: 'Misión SQL',
          instructions: 'Instrucciones SQL',
          success_criteria: 'Criterio SQL',
          resource_id: 'res-sql-1',
          estimated_minutes: 150,
          status: 'pending',
          completed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          resource: mockResources[0],
          skill: { id: 'skill-sql', slug: 'sql', name: 'SQL' },
        },
      ]);

      const plannerSpy = vi.spyOn(plannerRunner, 'runPlannerAgent').mockResolvedValue({
        objectives: [
          {
            skillSlug: 'sql',
            description: 'Dominar SQL para extracción de datos.',
            masteryCriteria: ['Escribir consultas con filtros'],
          },
          {
            skillSlug: 'spreadsheets',
            description: 'Dominar hojas de cálculo.',
            masteryCriteria: ['Crear tablas dinámicas'],
          },
        ],
        activities: [
          {
            slotId: 'w1-s1-resource-1',
            title: 'Misión inicial de SQL',
            mission: 'Explora tablas básicas.',
            instructions: 'Realiza el tutorial interactivo.',
            successCriteria: 'Completar los módulos 1 a 3.',
          },
          {
            slotId: 'w1-s1-practice-2',
            title: 'Práctica SQL guiada',
            mission: 'Practica consultas.',
            instructions: 'Escribe tres consultas SELECT.',
            successCriteria: 'Consultas ejecutadas.',
          },
          {
            slotId: 'w2-s1-resource-1',
            title: 'Misión de hojas de cálculo',
            mission: 'Aprende fórmulas.',
            instructions: 'Revisa el contenido.',
            successCriteria: 'Completar lectura.',
          },
          {
            slotId: 'w2-s1-practice-2',
            title: 'Práctica de hojas de cálculo',
            mission: 'Practica fórmulas.',
            instructions: 'Ejecuta ejercicios.',
            successCriteria: 'Fórmulas calculadas.',
          },
        ],
        weeklySummaries: [
          {
            week: 1,
            headline: 'Bases sólidas de SQL',
            note: 'Enfoque en queries.',
          },
          {
            week: 2,
            headline: 'Hojas de cálculo avanzadas',
            note: 'Enfoque en funciones.',
          },
        ],
      });

      // Execute
      const result = await generateInitialJourney(mockLearnerId);

      // Verify
      expect(result).toBeDefined();
      expect(result.journey.id).toBe(mockJourneyId);
      expect(plannerSpy).toHaveBeenCalledTimes(1); // EXACTLY AT MOST 1 CALL
    });

    it('throws 409 JOURNEY_EXISTS when an active journey already exists', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockJourneyRecord);

      const plannerSpy = vi.spyOn(plannerRunner, 'runPlannerAgent');

      await expect(generateInitialJourney(mockLearnerId)).rejects.toThrow(JourneyServiceError);
      try {
        await generateInitialJourney(mockLearnerId);
      } catch (err: unknown) {
        const error = err as JourneyServiceError;
        expect(error.code).toBe('JOURNEY_EXISTS');
        expect(error.status).toBe(409);
      }

      expect(plannerSpy).not.toHaveBeenCalled();
    });

    it('applies deterministic minimum fallback if Planner Agent fails or throws', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(resourcesRepo, 'getResourcesForSkills').mockResolvedValue(mockResources);
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValueOnce(null).mockResolvedValue(mockJourneyRecord);
      vi.spyOn(journeysRepo, 'getAllJourneysForLearner').mockResolvedValue([]);

      const createJourneySpy = vi
        .spyOn(journeysRepo, 'createJourney')
        .mockResolvedValue(mockJourneyRecord);
      vi.spyOn(objectivesRepo, 'createObjectives').mockResolvedValue([
        {
          id: 'obj-1',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Obj desc',
          mastery_criteria: ['Crit 1'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.spyOn(objectivesRepo, 'getObjectivesByLearner').mockResolvedValue([]);
      vi.spyOn(activitiesRepo, 'createActivities').mockResolvedValue([]);
      vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockResolvedValue([]);

      // Planner Agent fails
      vi.spyOn(plannerRunner, 'runPlannerAgent').mockRejectedValue(new Error('AI rate limit exceeded'));

      const result = await generateInitialJourney(mockLearnerId);

      expect(result).toBeDefined();
      expect(createJourneySpy).toHaveBeenCalled();
      const journeyArgs = createJourneySpy.mock.calls[0][0];
      expect(Boolean((journeyArgs.changes as Record<string, unknown>)?.isFallback)).toBe(true);
    });
  });

  describe('getActiveJourneyData', () => {
    it('retrieves active journey and performs ZERO AI calls', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockJourneyRecord);
      vi.spyOn(objectivesRepo, 'getObjectivesByLearner').mockResolvedValue([
        {
          id: 'obj-sql',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Dominar SQL',
          mastery_criteria: ['Crit 1'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockResolvedValue([
        {
          id: 'act-1',
          journey_id: mockJourneyId,
          objective_id: 'obj-sql',
          skill_id: 'skill-sql',
          week: 1,
          type: 'resource',
          title: 'Aprender SQL',
          mission: 'Misión SQL',
          instructions: 'Instrucciones',
          success_criteria: 'Criterio',
          resource_id: 'res-sql-1',
          estimated_minutes: 60,
          status: 'pending',
          completed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          resource: mockResources[0],
          skill: { id: 'skill-sql', slug: 'sql', name: 'SQL' },
        },
      ]);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);

      const plannerSpy = vi.spyOn(plannerRunner, 'runPlannerAgent');

      const result = await getActiveJourneyData(mockLearnerId);

      expect(result).toBeDefined();
      expect(result.journey.id).toBe(mockJourneyId);
      expect(result.weeks).toHaveLength(1);
      expect(result.weeks[0].activities).toHaveLength(1);
      expect(result.objectives).toHaveLength(1);
      expect(result.objectives[0].skillSlug).toBe('sql');
      expect(result.objectives[0].skillName).toBe('SQL');
      expect(plannerSpy).toHaveBeenCalledTimes(0); // ZERO AI CALLS
    });

    it('deduplicates objectives and populates skillName/skillSlug so duplicate objectives cannot reach the final journey contract', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockJourneyRecord);

      // Simulate database containing multiple/duplicate objectives for the same learner/skills:
      // - an old historical objective for SQL
      // - the active journey objective for SQL
      // - a duplicate active objective for SQL
      // - the active journey objective for Spreadsheets
      // - an unreferenced objective for an unscheduled skill (Python)
      vi.spyOn(objectivesRepo, 'getObjectivesByLearner').mockResolvedValue([
        {
          id: 'obj-sql-old',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Old SQL objective from previous journey',
          mastery_criteria: ['Old criteria'],
          target_level: 1,
          status: 'done',
          created_at: '2025-12-01T00:00:00Z',
        },
        {
          id: 'obj-sql-active-1',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Dominar consultas SQL para análisis de datos.',
          mastery_criteria: ['Escribir consultas con filtros WHERE'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'obj-sql-active-dup',
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          description: 'Duplicate active SQL objective',
          mastery_criteria: ['Duplicate criteria'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T01:00:00Z',
        },
        {
          id: 'obj-sheets-active-1',
          learner_id: mockLearnerId,
          skill_id: 'skill-sheets',
          description: 'Dominar tablas dinámicas en hojas de cálculo.',
          mastery_criteria: ['Crear tablas dinámicas con agrupaciones'],
          target_level: 2,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'obj-python-unscheduled',
          learner_id: mockLearnerId,
          skill_id: 'skill-python',
          description: 'Python básico no programado en este journey',
          mastery_criteria: ['Sintaxis básica'],
          target_level: 1,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      // Activities in active journey only schedule SQL and Spreadsheets
      vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockResolvedValue([
        {
          id: 'act-1',
          journey_id: mockJourneyId,
          objective_id: 'obj-sql-active-1',
          skill_id: 'skill-sql',
          week: 1,
          type: 'resource',
          title: 'Aprender SQL',
          mission: 'Misión SQL',
          instructions: 'Instrucciones SQL',
          success_criteria: 'Criterio SQL',
          resource_id: 'res-sql-1',
          estimated_minutes: 150,
          status: 'pending',
          completed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          resource: mockResources[0],
          skill: { id: 'skill-sql', slug: 'sql', name: 'SQL' },
        },
        {
          id: 'act-2',
          journey_id: mockJourneyId,
          objective_id: 'obj-sheets-active-1',
          skill_id: 'skill-sheets',
          week: 2,
          type: 'practice',
          title: 'Práctica Spreadsheets',
          mission: 'Misión Spreadsheets',
          instructions: 'Instrucciones Sheets',
          success_criteria: 'Criterio Sheets',
          resource_id: null,
          estimated_minutes: 150,
          status: 'pending',
          completed_at: null,
          created_at: '2026-01-01T00:00:00Z',
          skill: { id: 'skill-sheets', slug: 'spreadsheets', name: 'Spreadsheets' },
        },
      ]);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);

      const result = await getActiveJourneyData(mockLearnerId);

      // Contract: exactly one objective per scheduled skill
      expect(result.objectives).toHaveLength(2);

      const sqlObjective = result.objectives.find((o) => o.skillId === 'skill-sql');
      const sheetsObjective = result.objectives.find((o) => o.skillId === 'skill-sheets');

      expect(sqlObjective).toBeDefined();
      expect(sqlObjective?.id).toBe('obj-sql-active-1');
      expect(sqlObjective?.skillSlug).toBe('sql');
      expect(sqlObjective?.skillName).toBe('SQL');

      expect(sheetsObjective).toBeDefined();
      expect(sheetsObjective?.id).toBe('obj-sheets-active-1');
      expect(sheetsObjective?.skillSlug).toBe('spreadsheets');
      expect(sheetsObjective?.skillName).toBe('Spreadsheets');

      // Unscheduled or duplicate objectives never reach the final contract
      expect(result.objectives.some((o) => o.id === 'obj-sql-old')).toBe(false);
      expect(result.objectives.some((o) => o.id === 'obj-sql-active-dup')).toBe(false);
      expect(result.objectives.some((o) => o.id === 'obj-python-unscheduled')).toBe(false);
    });

    it('throws 404 when no active journey exists', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(null);

      await expect(getActiveJourneyData(mockLearnerId)).rejects.toThrow(JourneyServiceError);
      try {
        await getActiveJourneyData(mockLearnerId);
      } catch (err: unknown) {
        const error = err as JourneyServiceError;
        expect(error.code).toBe('NO_ACTIVE_JOURNEY');
        expect(error.status).toBe(404);
      }
    });
  });

  describe('completeActivity', () => {
    it('marks activity done, updates skill progress, does NOT change level, and makes ZERO AI calls', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(activitiesRepo, 'getActivityById').mockResolvedValue({
        id: 'act-1',
        journey_id: mockJourneyId,
        objective_id: 'obj-sql',
        skill_id: 'skill-sql',
        week: 1,
        type: 'resource',
        title: 'Aprender SQL',
        mission: 'Misión SQL',
        instructions: 'Instrucciones',
        success_criteria: 'Criterio',
        resource_id: 'res-sql-1',
        estimated_minutes: 150,
        status: 'pending',
        completed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      });
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockJourneyRecord);
      vi.spyOn(activitiesRepo, 'updateActivityStatus').mockResolvedValue({
        id: 'act-1',
        journey_id: mockJourneyId,
        objective_id: 'obj-sql',
        skill_id: 'skill-sql',
        week: 1,
        type: 'resource',
        title: 'Aprender SQL',
        mission: 'Misión SQL',
        instructions: 'Instrucciones',
        success_criteria: 'Criterio',
        resource_id: 'res-sql-1',
        estimated_minutes: 150,
        status: 'done',
        completed_at: '2026-01-02T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      });
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);

      const updateSkillSpy = vi
        .spyOn(learnerSkillsRepo, 'updateLearnerSkillProgress')
        .mockResolvedValue(mockLearnerSkills[0]);

      const plannerSpy = vi.spyOn(plannerRunner, 'runPlannerAgent');

      const result = await completeActivity('act-1', mockLearnerId);

      expect(result.success).toBe(true);
      expect(result.activity.status).toBe('done');
      // 150 min / (1 gap * 300 min/lvl) * 100 = 50% progress
      expect(result.skill.progress).toBe(50);
      expect(result.skill.status).toBe('in_progress');
      expect(result.skill.level).toBe(1); // LEVEL UNCHANGED!
      expect(updateSkillSpy).toHaveBeenCalledWith(mockLearnerId, 'skill-sql', 50, 'in_progress');
      expect(plannerSpy).toHaveBeenCalledTimes(0); // ZERO AI CALLS
    });

    it('rejects activity completion with 403 NOT_OWNER if activity belongs to another journey', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(activitiesRepo, 'getActivityById').mockResolvedValue({
        id: 'act-other',
        journey_id: 'other-journey',
        objective_id: 'obj-sql',
        skill_id: 'skill-sql',
        week: 1,
        type: 'resource',
        title: 'Other SQL',
        mission: 'Mission',
        instructions: 'Inst',
        success_criteria: 'Crit',
        resource_id: null,
        estimated_minutes: 60,
        status: 'pending',
        completed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      });
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockJourneyRecord);

      await expect(completeActivity('act-other', mockLearnerId)).rejects.toThrow(
        JourneyServiceError
      );
      try {
        await completeActivity('act-other', mockLearnerId);
      } catch (err: unknown) {
        const error = err as JourneyServiceError;
        expect(error.code).toBe('NOT_OWNER');
        expect(error.status).toBe(403);
      }
    });
  });

  describe('skipActivity', () => {
    it('marks activity skipped, returns count, does NOT replan, and makes ZERO AI calls', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
      vi.spyOn(activitiesRepo, 'getActivityById').mockResolvedValue({
        id: 'act-1',
        journey_id: mockJourneyId,
        objective_id: 'obj-sql',
        skill_id: 'skill-sql',
        week: 1,
        type: 'resource',
        title: 'Aprender SQL',
        mission: 'Misión SQL',
        instructions: 'Instrucciones',
        success_criteria: 'Criterio',
        resource_id: 'res-sql-1',
        estimated_minutes: 150,
        status: 'pending',
        completed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      });
      vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockJourneyRecord);
      vi.spyOn(activitiesRepo, 'updateActivityStatus').mockResolvedValue({
        id: 'act-1',
        journey_id: mockJourneyId,
        objective_id: 'obj-sql',
        skill_id: 'skill-sql',
        week: 1,
        type: 'resource',
        title: 'Aprender SQL',
        mission: 'Misión SQL',
        instructions: 'Instrucciones',
        success_criteria: 'Criterio',
        resource_id: 'res-sql-1',
        estimated_minutes: 150,
        status: 'skipped',
        completed_at: null,
        created_at: '2026-01-01T00:00:00Z',
      });
      vi.spyOn(activitiesRepo, 'getSkippedActivitiesCount').mockResolvedValue(1);

      const plannerSpy = vi.spyOn(plannerRunner, 'runPlannerAgent');
      const createJourneySpy = vi.spyOn(journeysRepo, 'createJourney');

      const result = await skipActivity('act-1', mockLearnerId);

      expect(result.success).toBe(true);
      expect(result.activity.status).toBe('skipped');
      expect(result.skippedCount).toBe(1);
      expect(createJourneySpy).not.toHaveBeenCalled(); // NO REPLANNING!
      expect(plannerSpy).toHaveBeenCalledTimes(0); // ZERO AI CALLS
    });
  });
});
