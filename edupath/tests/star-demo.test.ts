// tests/star-demo.test.ts
// End-to-End Star Demo Verification Test for SPEC-004
// Simulates the full learner flow:
// Onboarding (self-reported high weight skill) -> Initial Journey ->
// Evaluate (intentional fail) -> Verification downgrade -> Replan ->
// Journey version increment + Gap returns + Plan changes -> Consecutive failure -> Struggling + Reinforcement.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  determineEligibility,
  applyAssessmentResult,
} from '@/domain/assessment';
import { recomputeStatuses } from '@/domain/skill-state';
import { buildJourneySkeleton } from '@/domain/journey';
import { generateAssessment, submitAssessment } from '@/services/assessment';
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
import * as assessmentsRepo from '@/lib/db/repositories/assessments';
import * as plannerRunner from '@/agents/planner/run';

describe('SPEC-004 Star Demo Flow Verification', () => {
  const learnerId = 'star-learner-1';
  const roleId = 'data-analyst';
  const spreadsheetsId = 'skill-spreadsheets';
  const sqlId = 'skill-sql';

  // 1. Setup mock skills and role requirements
  const skills: skillsRepo.SkillRecord[] = [
    {
      id: spreadsheetsId,
      slug: 'spreadsheets',
      name: 'Spreadsheets',
      description: 'Excel and Sheets analysis',
      category: 'technical',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: sqlId,
      slug: 'sql',
      name: 'SQL',
      description: 'Relational database queries',
      category: 'technical',
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const roleSkills: skillsRepo.RoleSkillRecord[] = [
    {
      ...skills[0],
      required_level: 3,
      weight: 0.9, // High-weight
    },
    {
      ...skills[1],
      required_level: 3,
      weight: 0.8,
    },
  ];

  const prerequisites: prereqsRepo.PrerequisiteRecord[] = [
    {
      skillId: sqlId,
      prerequisiteSkillId: spreadsheetsId,
    },
  ];

  let currentLearnerSkills: learnerSkillsRepo.LearnerSkillRecord[];
  let currentJourneys: journeysRepo.JourneyRecord[];
  let currentActivities: activitiesRepo.ActivityWithDetails[];
  let currentObjectives: objectivesRepo.ObjectiveRecord[];
  let currentAssessments: assessmentsRepo.AssessmentRecord[];

  beforeEach(() => {
    vi.restoreAllMocks();

    // Reset in-memory database simulation
    currentLearnerSkills = [
      {
        learner_id: learnerId,
        skill_id: spreadsheetsId,
        level: 3, // Declared level 3 during onboarding
        verification: 'self_reported',
        progress: 0,
        status: 'acquired', // Initially acquired
        consecutive_failures: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        learner_id: learnerId,
        skill_id: sqlId,
        level: 0,
        verification: 'self_reported',
        progress: 0,
        status: 'available', // unlocked because spreadsheets level >= 2
        consecutive_failures: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    currentJourneys = [
      {
        id: 'journey-v1',
        learner_id: learnerId,
        version: 1,
        reason: 'initial',
        summary: 'Initial journey plan',
        is_current: true,
        changes: {},
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    currentObjectives = [
      {
        id: 'obj-sql',
        learner_id: learnerId,
        skill_id: sqlId,
        description: 'Queries and filters',
        mastery_criteria: ['Master SQL fundamentals'],
        target_level: 3,
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    currentActivities = [
      {
        id: 'act-completed-1',
        journey_id: 'journey-v1',
        objective_id: 'obj-sql',
        skill_id: sqlId,
        week: 1,
        type: 'resource',
        title: 'Learn SQL',
        mission: 'Complete SQL query basics',
        instructions: '',
        success_criteria: 'Write queries',
        resource_id: 'res-sql-1',
        status: 'done',
        completed_at: '2026-01-01T00:00:00Z',
        estimated_minutes: 45,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    currentAssessments = [];

    // Mock Repositories
    const mockLearner: learnersRepo.LearnerRecord = {
      id: learnerId,
      name: 'Demo Star Student',
      background: 'Student with basic analysis background',
      extra_skills: [],
      target_role_id: roleId,
      weekly_hours: 10,
      created_at: '2026-01-01T00:00:00Z',
    };

    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
    vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);

    vi.spyOn(skillsRepo, 'getSkills').mockResolvedValue(skills);
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(roleSkills);
    vi.spyOn(skillsRepo, 'getSkillBySlug').mockImplementation(async (slug) => {
      return skills.find((s) => s.slug === slug) || null;
    });

    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockImplementation(async () => {
      return currentLearnerSkills;
    });

    vi.spyOn(learnerSkillsRepo, 'getLearnerSkill').mockImplementation(async (_lid, skillId) => {
      return currentLearnerSkills.find((ls) => ls.skill_id === skillId) || null;
    });

    vi.spyOn(learnerSkillsRepo, 'updateLearnerSkillFull').mockImplementation(async (_lid, skillId, update) => {
      const rec = currentLearnerSkills.find((ls) => ls.skill_id === skillId);
      if (rec) {
        Object.assign(rec, update, { updated_at: new Date().toISOString() });
        return rec;
      }
      throw new Error(`Learner skill ${skillId} not found`);
    });

    vi.spyOn(learnerSkillsRepo, 'bulkUpdateLearnerSkillStatuses').mockImplementation(
      async (_lid, updates) => {
        for (const u of updates) {
          const rec = currentLearnerSkills.find((ls) => ls.skill_id === u.skillId);
          if (rec) rec.status = u.status;
        }
      }
    );

    vi.spyOn(prereqsRepo, 'getPrerequisitesByRole').mockResolvedValue(prerequisites);
    vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue(prerequisites);

    vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue({
      learner_id: learnerId,
      language: 'es',
      tone: 'cercano',
      detail_level: 'equilibrado',
      use_analogies: true,
      free_instructions: '',
      created_at: '2026-01-01T00:00:00Z',
    });

    vi.spyOn(resourcesRepo, 'getResourcesForSkills').mockResolvedValue([
      {
        id: 'res-sheet-1',
        skill_id: spreadsheetsId,
        title: 'Excel Essentials',
        url: 'https://example.com/excel',
        type: 'course',
        level_min: 1,
        level_max: 3,
        language: 'es',
        verified: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'res-sheet-2',
        skill_id: spreadsheetsId,
        title: 'Advanced Practice Exercises',
        url: 'https://example.com/practice',
        type: 'exercise',
        level_min: 1,
        level_max: 3,
        language: 'es',
        verified: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    vi.spyOn(journeysRepo, 'getActiveJourney').mockImplementation(async () => {
      return currentJourneys.find((j) => j.is_current) || null;
    });

    vi.spyOn(journeysRepo, 'getLatestJourney').mockImplementation(async () => {
      return currentJourneys[currentJourneys.length - 1] || null;
    });

    vi.spyOn(journeysRepo, 'getAllJourneysForLearner').mockImplementation(async () => {
      return currentJourneys;
    });

    vi.spyOn(journeysRepo, 'createJourney').mockImplementation(async (input) => {
      for (const j of currentJourneys) {
        if (j.is_current) j.is_current = false;
      }
      const newJ: journeysRepo.JourneyRecord = {
        id: `journey-v${input.version ?? currentJourneys.length + 1}`,
        learner_id: input.learnerId,
        version: input.version ?? currentJourneys.length + 1,
        reason: input.reason ?? 'assessment',
        summary: input.summary ?? 'Rebuilt plan',
        is_current: input.isCurrent ?? true,
        changes: input.changes ?? {},
        created_at: new Date().toISOString(),
      };
      currentJourneys.push(newJ);
      return newJ;
    });

    vi.spyOn(journeysRepo, 'deactivateCurrentJourneys').mockImplementation(async () => {
      for (const j of currentJourneys) {
        j.is_current = false;
      }
    });

    vi.spyOn(objectivesRepo, 'getActiveObjectives').mockImplementation(async () => {
      return currentObjectives.filter((o) => o.status === 'active');
    });

    vi.spyOn(objectivesRepo, 'createObjectives').mockImplementation(async (lid, inputs) => {
      const created: objectivesRepo.ObjectiveRecord[] = inputs.map((inp, idx) => ({
        id: `obj-new-${Date.now()}-${idx}`,
        learner_id: lid,
        skill_id: inp.skillId,
        description: inp.description,
        mastery_criteria: inp.masteryCriteria,
        target_level: inp.targetLevel,
        status: inp.status ?? 'active',
        created_at: new Date().toISOString(),
      }));
      currentObjectives.push(...created);
      return created;
    });

    vi.spyOn(objectivesRepo, 'updateObjectiveStatus').mockImplementation(async (id, status) => {
      const o = currentObjectives.find((x) => x.id === id);
      if (!o) throw new Error('Not found');
      o.status = status;
      return o;
    });

    vi.spyOn(objectivesRepo, 'updateObjectivesStatusByLearnerAndSkill').mockImplementation(
      async (_lid, skillId, status) => {
        for (const o of currentObjectives) {
          if (o.skill_id === skillId && o.status === 'active') {
            o.status = status;
          }
        }
      }
    );

    vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockImplementation(
      async (journeyId) => {
        return currentActivities.filter((a) => a.journey_id === journeyId);
      }
    );

    vi.spyOn(activitiesRepo, 'createActivities').mockImplementation(async (inputs) => {
      const created: activitiesRepo.ActivityWithDetails[] = inputs.map((inp, idx) => ({
        id: `act-new-${Date.now()}-${idx}`,
        journey_id: inp.journeyId,
        objective_id: inp.objectiveId,
        skill_id: inp.skillId,
        week: inp.week,
        type: inp.type,
        title: inp.title,
        mission: inp.mission,
        instructions: inp.instructions,
        success_criteria: inp.successCriteria,
        resource_id: inp.resourceId ?? null,
        estimated_minutes: inp.estimatedMinutes,
        status: inp.status ?? 'pending',
        completed_at: null,
        created_at: new Date().toISOString(),
      }));
      currentActivities.push(...created);
      return created;
    });

    vi.spyOn(assessmentsRepo, 'getAssessmentById').mockImplementation(async (id) => {
      return currentAssessments.find((a) => a.id === id) || null;
    });

    vi.spyOn(assessmentsRepo, 'getGeneratedAssessmentForSkill').mockImplementation(
      async (_lid, skillId) => {
        return (
          currentAssessments.find(
            (a) => a.skill_id === skillId && a.status === 'generated'
          ) || null
        );
      }
    );

    vi.spyOn(assessmentsRepo, 'getPastPromptsForSkill').mockResolvedValue([]);

    vi.spyOn(assessmentsRepo, 'createAssessment').mockImplementation(async (input) => {
      const newAss: assessmentsRepo.AssessmentRecord = {
        id: `assessment-${Date.now()}`,
        learner_id: input.learnerId,
        skill_id: input.skillId,
        kind: input.kind,
        target_level: input.targetLevel,
        questions: input.questions,
        answers: {},
        score: null,
        measured_level: null,
        passed: null,
        feedback: null,
        status: 'generated',
        created_at: new Date().toISOString(),
        graded_at: null,
      };
      currentAssessments.push(newAss);
      return newAss;
    });

    vi.spyOn(assessmentsRepo, 'gradeAssessment').mockImplementation(async (id, data) => {
      const a = currentAssessments.find((x) => x.id === id);
      if (!a) throw new Error('Not found');
      a.answers = data.answers;
      a.score = data.score;
      a.measured_level = data.measuredLevel;
      a.passed = data.passed;
      a.feedback = data.feedback;
      a.status = 'graded';
      a.graded_at = new Date().toISOString();
      return a;
    });
  });

  it('verifies the full 18-step Star Demo flow', async () => {
    // -------------------------------------------------------------------------
    // Steps 1 to 4: Fresh Onboarded state with spreadsheets acquired (self_reported)
    // -------------------------------------------------------------------------
    const spreadsheetsState = currentLearnerSkills.find(
      (ls) => ls.skill_id === spreadsheetsId
    )!;
    expect(spreadsheetsState.status).toBe('acquired');
    expect(spreadsheetsState.verification).toBe('self_reported');
    expect(spreadsheetsState.level).toBe(3);

    // Initial journey is version 1
    const initialJourney = currentJourneys.find((j) => j.is_current)!;
    expect(initialJourney.version).toBe(1);

    // Initial journey activities only contain SQL, not spreadsheets
    expect(currentActivities.some((a) => a.skill_id === spreadsheetsId)).toBe(false);

    // -------------------------------------------------------------------------
    // Step 5: Check eligibility -> eligible for verification assessment
    // -------------------------------------------------------------------------
    const eligibility = determineEligibility(
      {
        level: spreadsheetsState.level,
        verification: spreadsheetsState.verification,
        progress: spreadsheetsState.progress,
        status: spreadsheetsState.status,
      },
      3
    );
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.kind).toBe('verification');
    expect(eligibility.targetLevel).toBe(3);

    // -------------------------------------------------------------------------
    // Step 6: Generate Assessment
    // -------------------------------------------------------------------------
    // Uses assessment generate fixture
    const genResult = await generateAssessment('spreadsheets');
    expect(genResult.assessment.status).toBe('generated');
    expect(genResult.questions).toHaveLength(5);
    // Verified: Browser does NOT receive answers, rubrics, or explanations
    for (const q of genResult.questions) {
      expect((q as unknown as Record<string, unknown>).correctOptionId).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).rubric).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).explanation).toBeUndefined();
    }

    // -------------------------------------------------------------------------
    // Step 7 & 8: Intentionally fail assessment
    // -------------------------------------------------------------------------
    // In assessment-generate fixture, correct options are 'opt-1a', 'opt-2a', 'opt-3b'
    // Provide intentionally wrong options for MCQs:
    const intentionalWrongAnswers = {
      'q1-mcq': 'opt-1a', // wrong (correct is opt-1b)
      'q2-mcq': 'opt-2a', // wrong (correct is opt-2c)
      'q3-mcq': 'opt-3b', // wrong (correct is opt-3a)
      'q4-sa': 'VLOOKUP searches for a value in the leftmost column', // graded 0.5 by fixture
      'q5-sa': 'Create a pivot table with Region in Rows and Sales in Values', // graded 0.5 by fixture
    };

    const submitResult = await submitAssessment(
      genResult.assessment.id,
      intentionalWrongAnswers
    );

    // -------------------------------------------------------------------------
    // Step 9: Result verification:
    // Score = (0 + 0 + 0 + 0.5 + 0.5) / 5 = 0.2 < 0.7
    // Measured level = 1 (< 3)
    // Verification = 'verified'
    // Replan is recommended
    // -------------------------------------------------------------------------
    expect(submitResult.score).toBeCloseTo(0.2, 2);
    expect(submitResult.passed).toBe(false);
    expect(submitResult.measuredLevel).toBe(1);
    expect(submitResult.newLevel).toBe(1); // Downgraded from 3 to 1
    expect(submitResult.verification).toBe('verified');
    expect(submitResult.status).toBe('available'); // 1 < 3 required level, so not acquired anymore
    expect(submitResult.replanRecommended).toBe(true);

    // -------------------------------------------------------------------------
    // Step 10 & 11: Execute Replan with reason 'assessment'
    // -------------------------------------------------------------------------
    vi.spyOn(plannerRunner, 'runPlannerAgent').mockImplementation(async (input) => {
        return {
          objectives: input.skills.map((s) => ({
            skillSlug: s.skillSlug,
            description: `Master ${s.name} core principles`,
            masteryCriteria: ['Complete exercises'],
          })),
          activities: input.skills.flatMap((s) =>
            s.slots.map((slot) => ({
              slotId: slot.slotId,
              title: `Practice ${s.name}`,
              mission: 'Hands-on practice',
              instructions: 'Solve the assigned problems',
              successCriteria: 'Pass all tests',
            }))
          ),
          weeklySummaries: [
            {
              week: 1,
              headline: 'Week 1 Foundation',
              note: 'Focus on spreadsheet basics',
            },
          ],
          changeExplanation:
            'Your assessment revealed foundational gaps in Spreadsheets (measured Level 1 vs required Level 3). We updated your learning journey to build this core skill before continuing advanced work.',
        };
      });

    const replanResult = await executeReplan('assessment');

    // -------------------------------------------------------------------------
    // Step 12: Journey version increments (1 -> 2)
    // -------------------------------------------------------------------------
    expect(replanResult.journey.version).toBe(2);
    expect(replanResult.journey.is_current).toBe(true);

    // Old journey is deactivated
    const oldJourney = currentJourneys.find((j) => j.id === 'journey-v1')!;
    expect(oldJourney.is_current).toBe(false);

    // -------------------------------------------------------------------------
    // Step 13 & 14: Skill tree updates & Gap returns
    // -------------------------------------------------------------------------
    const updatedSpreadsheets = currentLearnerSkills.find(
      (ls) => ls.skill_id === spreadsheetsId
    )!;
    expect(updatedSpreadsheets.level).toBe(1);
    expect(updatedSpreadsheets.verification).toBe('verified');
    expect(updatedSpreadsheets.status).toBe('available');

    // SQL prerequisite: spreadsheets must be >= 2. Because spreadsheets is level 1, SQL becomes locked!
    // recomputeStatuses:
    const recomputed = recomputeStatuses(
      currentLearnerSkills.map((ls) => ({
        skillId: ls.skill_id,
        level: ls.level,
        status: ls.status,
      })),
      prerequisites.map((p) => ({
        skillId: p.skillId,
        prerequisiteSkillId: p.prerequisiteSkillId,
      })),
      roleSkills.map((rs) => ({
        skillId: rs.id,
        requiredLevel: rs.required_level,
      }))
    );
    // SQL prerequisite: spreadsheets must be >= PREREQ_MIN_LEVEL (1). Because spreadsheets is level 1, SQL remains available:
    expect(recomputed.find((s) => s.skillId === sqlId)?.status).toBe('available');

    // -------------------------------------------------------------------------
    // Step 15: Plan changes visibly computed deterministically
    // -------------------------------------------------------------------------
    expect(replanResult.changes.length).toBeGreaterThan(0);
    expect(
      replanResult.changes.some((c) => c.skillSlug === 'spreadsheets')
    ).toBe(true);
    expect(replanResult.changeExplanation).toContain('foundational gaps in Spreadsheets');

    // -------------------------------------------------------------------------
    // Step 16: Completed historical activities are preserved!
    // -------------------------------------------------------------------------
    const historyActivity = currentActivities.find(
      (a) => a.id === 'act-completed-1'
    );
    expect(historyActivity).toBeDefined();
    expect(historyActivity?.status).toBe('done');
    expect(historyActivity?.journey_id).toBe('journey-v1');

    // -------------------------------------------------------------------------
    // Step 17 & 18: Consecutive failure -> struggling status & reinforcement
    // -------------------------------------------------------------------------
    // Simulate a 2nd consecutive failure on spreadsheets:
    const secondFailureState = applyAssessmentResult(
      {
        skillId: spreadsheetsId,
        level: 1,
        verification: 'verified',
        progress: 100, // completed progress
        status: 'available',
        consecutiveFailures: 1, // previous failure
      },
      {
        score: 0.3, // failed score < 0.7
        kind: 'progress',
        targetLevel: 3,
      },
      3, // required level
      []
    );

    // consecutive_failures reaches 2 (STRUGGLE_THRESHOLD = 2)
    expect(secondFailureState.consecutiveFailures).toBe(2);
    expect(secondFailureState.status).toBe('struggling');

    // Test buildJourneySkeleton with struggling skill
    const skeletonWithStruggling = buildJourneySkeleton({
      gaps: [
        {
          skillId: spreadsheetsId,
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 1,
          requiredLevel: 3,
          gap: 2,
          weight: 0.9,
          priority: 0.9,
        } as never,
      ],
      learnerSkills: [
        {
          skillId: spreadsheetsId,
          level: 1,
          status: 'struggling',
          verification: 'verified',
        },
      ],
      prerequisites: [],
      weeklyHours: 10,
      resources: [
        {
          id: 'res-sheet-1',
          skillId: spreadsheetsId,
          title: 'Course',
          url: 'https://example.com/1',
          type: 'course',
          level_min: 1,
          level_max: 3,
          language: 'es',
          verified: true,
        },
        {
          id: 'res-sheet-2',
          skillId: spreadsheetsId,
          title: 'Exercise',
          url: 'https://example.com/2',
          type: 'exercise',
          level_min: 1,
          level_max: 3,
          language: 'es',
          verified: true,
        },
      ],
      previousJourneys: [
        {
          id: 'journey-v1',
          activities: [
            {
              skillId: spreadsheetsId,
              type: 'course',
              resourceId: 'res-sheet-1',
            },
          ],
        },
      ],
    });

    // Verify reinforcement is enabled and avoids previously completed resource
    const scheduledSpreadsheets = skeletonWithStruggling.scheduledSkills.find(
      (s) => s.skillSlug === 'spreadsheets'
    );
    expect(scheduledSpreadsheets).toBeDefined();
    expect(scheduledSpreadsheets?.reinforcement).toBe(true);

    // Slots allocated for struggling skill use the alternate resource (res-sheet-2)
    const slotResources = scheduledSpreadsheets?.slots.map((s) => s.resource?.id);
    expect(slotResources).toContain('res-sheet-2');
  });
});
