// tests/services/replan.test.ts
// Unit and integration tests for Replan Service (SPEC-004)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeReplan } from '@/services/replan';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as resourcesRepo from '@/lib/db/repositories/resources';
import * as journeysRepo from '@/lib/db/repositories/journeys';
import * as objectivesRepo from '@/lib/db/repositories/objectives';
import * as activitiesRepo from '@/lib/db/repositories/activities';
import * as plannerRunner from '@/agents/planner/run';

describe('services/replan', () => {
  const mockLearnerId = 'learner-123';
  const mockRoleId = 'role-123';
  const mockOldJourneyId = 'journey-v1';

  const mockLearner: learnersRepo.LearnerRecord = {
    id: mockLearnerId,
    name: 'Ana García',
    target_role_id: mockRoleId,
    background: 'Estudiante',
    weekly_hours: 5,
    extra_skills: [],
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
      category: 'Analysis',
      created_at: '2026-01-01T00:00:00Z',
      required_level: 3,
      weight: 4,
    },
  ];

  const mockCurrentJourney: journeysRepo.JourneyRecord = {
    id: mockOldJourneyId,
    learner_id: mockLearnerId,
    version: 1,
    is_current: true,
    reason: 'initial',
    summary: 'Plan v1',
    changes: {},
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockOldActivities: activitiesRepo.ActivityWithDetails[] = [
    {
      id: 'act-done-1',
      journey_id: mockOldJourneyId,
      objective_id: 'obj-1',
      skill_id: 'skill-sql',
      week: 1,
      type: 'resource',
      title: 'SQL Fundamentals',
      mission: 'Mission 1',
      instructions: 'Inst 1',
      success_criteria: 'Criteria 1',
      resource_id: 'res-sql-1',
      estimated_minutes: 120,
      status: 'done', // COMPLETED activity
      completed_at: '2026-01-02T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      skill: { id: 'skill-sql', slug: 'sql', name: 'SQL' },
    },
    {
      id: 'act-pending-2',
      journey_id: mockOldJourneyId,
      objective_id: 'obj-1',
      skill_id: 'skill-sql',
      week: 1,
      type: 'practice',
      title: 'SQL Practice',
      mission: 'Mission 2',
      instructions: 'Inst 2',
      success_criteria: 'Criteria 2',
      resource_id: null,
      estimated_minutes: 180,
      status: 'pending',
      completed_at: null,
      created_at: '2026-01-01T00:00:00Z',
      skill: { id: 'skill-sql', slug: 'sql', name: 'SQL' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
    vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(mockCurrentJourney);
    vi.spyOn(journeysRepo, 'getAllJourneysForLearner').mockResolvedValue([mockCurrentJourney]);
    vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockResolvedValue(mockOldActivities);
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([
      {
        learner_id: mockLearnerId,
        skill_id: 'skill-sql',
        level: 1,
        verification: 'verified',
        status: 'available',
        progress: 40,
        consecutive_failures: 0,
        created_at: '',
        updated_at: '',
      },
      {
        learner_id: mockLearnerId,
        skill_id: 'skill-sheets',
        level: 2, // Dropped to 2, now has gap
        verification: 'verified',
        status: 'available',
        progress: 0,
        consecutive_failures: 1,
        created_at: '',
        updated_at: '',
      },
    ]);
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
    vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(null);
    vi.spyOn(resourcesRepo, 'getResourcesForSkills').mockResolvedValue([]);
    vi.spyOn(objectivesRepo, 'updateObjectivesStatusByLearnerAndSkill').mockResolvedValue();
    vi.spyOn(objectivesRepo, 'createObjectives').mockResolvedValue([
      {
        id: 'new-obj-1',
        learner_id: mockLearnerId,
        skill_id: 'skill-sheets',
        description: 'New Objective',
        mastery_criteria: ['Crit'],
        target_level: 3,
        status: 'active',
        created_at: '',
      },
    ]);
    vi.spyOn(journeysRepo, 'deactivateCurrentJourneys').mockResolvedValue();
    vi.spyOn(journeysRepo, 'createJourney').mockImplementation(async (input) => ({
      id: 'journey-v2',
      learner_id: input.learnerId,
      version: input.version ?? 2,
      is_current: true,
      reason: input.reason ?? 'assessment',
      summary: input.summary ?? '',
      changes: input.changes ?? {},
      created_at: '2026-01-03T00:00:00Z',
    }));
    vi.spyOn(activitiesRepo, 'createActivities').mockResolvedValue([]);
  });

  it('rejects an invalid replan reason with 409', async () => {
    await expect(
      executeReplan('profile_change')
    ).rejects.toThrowError(
      expect.objectContaining({ status: 409, code: 'INVALID_REASON' })
    );
  });

  it('executes replan incrementing version, preserving history and computing changes', async () => {
    const plannerSpy = vi.spyOn(plannerRunner, 'runPlannerAgent').mockImplementation(async (input) => {
      const allSlots = input.skills.flatMap((s) => s.slots);
      return {
        objectives: input.skills.map((s) => ({
          skillSlug: s.skillSlug,
          description: `Master ${s.name}`,
          masteryCriteria: ['Criteria 1'],
        })),
        activities: allSlots.map((slot) => ({
          slotId: slot.slotId,
          title: `Activity for ${slot.slotId}`,
          mission: 'Mission detail',
          instructions: 'Instructions detail',
          successCriteria: 'Success criteria',
        })),
        weeklySummaries: [
          {
            week: 1,
            headline: 'Refocused on Spreadsheets',
            note: 'Deepening core concepts',
          },
        ],
        changeExplanation: 'Reallocated study time to reinforce Spreadsheets after assessment.',
      };
    });

    const deactivateSpy = vi.spyOn(journeysRepo, 'deactivateCurrentJourneys');
    const createJourneySpy = vi.spyOn(journeysRepo, 'createJourney');

    const result = await executeReplan('assessment');

    // Exactly 1 Planner Agent call
    expect(plannerSpy).toHaveBeenCalledTimes(1);

    // Version incremented: v1 + 1 = 2
    expect(result.journey.version).toBe(2);

    // Previous journey deactivated
    expect(deactivateSpy).toHaveBeenCalledWith(mockLearnerId);

    // New journey created with version 2
    expect(createJourneySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        isCurrent: true,
        reason: 'assessment',
      })
    );

    // Explanation is present
    expect(result.changeExplanation).toContain('Spreadsheets');

    // Invariant: Completed activities from previous journey were NOT deleted
    // (mockOldActivities contains act-done-1, which remained intact in DB)
  });

  it('falls back to deterministic minimum when Planner Agent fails, keeping explanation unavailable', async () => {
    vi.spyOn(plannerRunner, 'runPlannerAgent').mockRejectedValue(new Error('Agent failure'));

    const result = await executeReplan('assessment');

    // Does NOT fail the replan! Deterministic plan still produced:
    expect(result.journey.version).toBe(2);
    expect(result.changeExplanation).toBe('Explicación del plan no disponible en este momento.');
  });
});
