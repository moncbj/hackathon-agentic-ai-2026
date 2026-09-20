import { describe, it, expect } from 'vitest';
import {
  scoreAssessment,
  measureLevel,
  determineEligibility,
  applyAssessmentResult,
  AssessmentQuestion,
} from '@/domain/assessment';
import {
  recomputeStatuses,
  needsReplan,
} from '@/domain/skill-state';
import {
  shouldReplanForSkippedActivities,
  computeJourneyChanges,
  JourneySkeleton,
} from '@/domain/journey';

describe('SPEC-004 domain: scoreAssessment', () => {
  const sampleQuestions: AssessmentQuestion[] = [
    {
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Q1',
      correctOptionId: 'opt-a',
    },
    {
      id: 'q2',
      type: 'multiple_choice',
      prompt: 'Q2',
      correctOptionId: 'opt-b',
    },
    {
      id: 'q3',
      type: 'multiple_choice',
      prompt: 'Q3',
      correctOptionId: 'opt-c',
    },
    {
      id: 'q4',
      type: 'short_answer',
      prompt: 'Q4',
    },
    {
      id: 'q5',
      type: 'short_answer',
      prompt: 'Q5',
    },
  ];

  it('reproduces the SPEC-004 official 0.6 calculation example', () => {
    // 3 MCQ: 1 (correct), 0 (incorrect), 1 (correct)
    // 2 Short: 0.5, 0.5
    // Result = (1 + 0 + 1 + 0.5 + 0.5) / 5 = 3.0 / 5 = 0.6
    const score = scoreAssessment({
      questions: sampleQuestions,
      mcqAnswers: {
        q1: 'opt-a', // 1
        q2: 'opt-wrong', // 0
        q3: 'opt-c', // 1
      },
      agentGrades: [
        { questionId: 'q4', score: 0.5 },
        { questionId: 'q5', score: 0.5 },
      ],
    });

    expect(score).toBe(0.6);
  });

  it('returns 1.0 when all MCQ and short answers are fully correct', () => {
    const score = scoreAssessment({
      questions: sampleQuestions,
      mcqAnswers: {
        q1: 'opt-a',
        q2: 'opt-b',
        q3: 'opt-c',
      },
      agentGrades: [
        { questionId: 'q4', score: 1.0 },
        { questionId: 'q5', score: 1.0 },
      ],
    });

    expect(score).toBe(1.0);
  });

  it('returns 0.0 when all answers are incorrect or missing', () => {
    const score = scoreAssessment({
      questions: sampleQuestions,
      mcqAnswers: {},
      agentGrades: [],
    });

    expect(score).toBe(0.0);
  });
});

describe('SPEC-004 domain: measureLevel', () => {
  it('returns targetLevel when score >= PASS_THRESHOLD (0.7)', () => {
    expect(measureLevel(0.7, 3)).toBe(3);
    expect(measureLevel(0.9, 3)).toBe(3);
    expect(measureLevel(1.0, 2)).toBe(2);
  });

  it('returns targetLevel - 1 when score >= PARTIAL_THRESHOLD (0.4) and < 0.7', () => {
    expect(measureLevel(0.4, 3)).toBe(2);
    expect(measureLevel(0.5, 3)).toBe(2);
    expect(measureLevel(0.69, 3)).toBe(2);
  });

  it('returns targetLevel - 2 when score < 0.4, with minimum 0', () => {
    expect(measureLevel(0.3, 3)).toBe(1);
    expect(measureLevel(0.0, 3)).toBe(1);
    expect(measureLevel(0.2, 1)).toBe(0); // 1 - 2 clamped to 0
    expect(measureLevel(0.1, 0)).toBe(0);
  });
});

describe('SPEC-004 domain: determineEligibility', () => {
  it('identifies verification eligibility when self_reported and level >= 1', () => {
    const result = determineEligibility(
      { level: 2, verification: 'self_reported', progress: 50 },
      3
    );
    expect(result.eligible).toBe(true);
    expect(result.kind).toBe('verification');
    expect(result.targetLevel).toBe(2);
  });

  it('identifies progress eligibility when progress >= 100', () => {
    const result = determineEligibility(
      { level: 1, verification: 'verified', progress: 100 },
      3
    );
    expect(result.eligible).toBe(true);
    expect(result.kind).toBe('progress');
    expect(result.targetLevel).toBe(3);
  });

  it('prioritizes progress when both verification and progress apply', () => {
    const result = determineEligibility(
      { level: 1, verification: 'self_reported', progress: 100 },
      3
    );
    expect(result.eligible).toBe(true);
    expect(result.kind).toBe('progress');
    expect(result.targetLevel).toBe(3);
  });

  it('returns ineligible when level is 0 and progress < 100', () => {
    const result = determineEligibility(
      { level: 0, verification: 'self_reported', progress: 80 },
      3
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns ineligible when already verified and progress < 100', () => {
    const result = determineEligibility(
      { level: 2, verification: 'verified', progress: 30 },
      3
    );
    expect(result.eligible).toBe(false);
  });
});

describe('SPEC-004 domain: applyAssessmentResult (All 5 SPEC Examples)', () => {
  // Example 1: verification, current 3, req 3, target 3, score 0.5 -> Level 2, verified, 1 failure, available
  it('SPEC Example 1: verification with score 0.5 drops level to 2, 1 failure, status available', () => {
    const updated = applyAssessmentResult(
      {
        skillId: 's1',
        level: 3,
        verification: 'self_reported',
        status: 'acquired',
        progress: 0,
        consecutiveFailures: 0,
      },
      {
        kind: 'verification',
        targetLevel: 3,
        score: 0.5,
      },
      3
    );

    expect(updated.level).toBe(2);
    expect(updated.verification).toBe('verified');
    expect(updated.passed).toBe(false);
    expect(updated.consecutiveFailures).toBe(1);
    expect(updated.status).toBe('available');
    expect(updated.progress).toBe(0);
  });

  // Example 2: progress, current 1, req 3, target 3, score 0.8 -> Level 3, verified, 0 failures, acquired
  it('SPEC Example 2: progress with score 0.8 promotes to Level 3, acquired, 0 failures', () => {
    const updated = applyAssessmentResult(
      {
        skillId: 's1',
        level: 1,
        verification: 'verified',
        status: 'in_progress',
        progress: 100,
        consecutiveFailures: 1,
      },
      {
        kind: 'progress',
        targetLevel: 3,
        score: 0.8,
      },
      3
    );

    expect(updated.level).toBe(3);
    expect(updated.verification).toBe('verified');
    expect(updated.passed).toBe(true);
    expect(updated.consecutiveFailures).toBe(0);
    expect(updated.status).toBe('acquired');
    expect(updated.progress).toBe(0);
  });

  // Example 3: progress, current 1, req 3, target 3, score 0.5 -> Level 2, 1 failure, available
  it('SPEC Example 3: progress with score 0.5 advances to Level 2, 1 failure, available', () => {
    const updated = applyAssessmentResult(
      {
        skillId: 's1',
        level: 1,
        verification: 'verified',
        status: 'in_progress',
        progress: 100,
        consecutiveFailures: 0,
      },
      {
        kind: 'progress',
        targetLevel: 3,
        score: 0.5,
      },
      3
    );

    expect(updated.level).toBe(2);
    expect(updated.verification).toBe('verified');
    expect(updated.passed).toBe(false);
    expect(updated.consecutiveFailures).toBe(1);
    expect(updated.status).toBe('available');
    expect(updated.progress).toBe(0);
  });

  // Example 4: progress, current 1, req 3, target 3, score 0.3 -> Level 1 (does not drop). With 1 previous failure: 2 failures, struggling
  it('SPEC Example 4: progress score 0.3 does not drop level 1, reaches 2 failures -> struggling', () => {
    const updated = applyAssessmentResult(
      {
        skillId: 's1',
        level: 1,
        verification: 'verified',
        status: 'in_progress',
        progress: 100,
        consecutiveFailures: 1, // 1 previous failure
      },
      {
        kind: 'progress',
        targetLevel: 3,
        score: 0.3,
      },
      3
    );

    expect(updated.level).toBe(1); // Never drops in progress assessment
    expect(updated.verification).toBe('verified');
    expect(updated.passed).toBe(false);
    expect(updated.consecutiveFailures).toBe(2);
    expect(updated.status).toBe('struggling');
    expect(updated.progress).toBe(0);
  });

  // Example 5: verification, current 2, req 2, target 2, score 0.9 -> Level 2, verified, acquired
  it('SPEC Example 5: verification score 0.9 keeps Level 2, verified, acquired', () => {
    const updated = applyAssessmentResult(
      {
        skillId: 's1',
        level: 2,
        verification: 'self_reported',
        status: 'available',
        progress: 0,
        consecutiveFailures: 0,
      },
      {
        kind: 'verification',
        targetLevel: 2,
        score: 0.9,
      },
      2
    );

    expect(updated.level).toBe(2);
    expect(updated.verification).toBe('verified');
    expect(updated.passed).toBe(true);
    expect(updated.consecutiveFailures).toBe(0);
    expect(updated.status).toBe('acquired');
    expect(updated.progress).toBe(0);
  });
});

describe('SPEC-004 domain: recomputeStatuses', () => {
  it('unlocks dependent skills when prerequisite rises to level >= 1', () => {
    const allSkills = [
      { skillId: 'prereq', level: 1, status: 'available' as const },
      { skillId: 'dependent', level: 0, status: 'locked' as const },
    ];
    const prerequisites = [{ skillId: 'dependent', prerequisiteSkillId: 'prereq' }];

    const recomputed = recomputeStatuses(allSkills, prerequisites);
    const dep = recomputed.find((s) => s.skillId === 'dependent')!;
    expect(dep.status).toBe('available');
  });

  it('keeps dependent locked if prerequisite is level 0', () => {
    const allSkills = [
      { skillId: 'prereq', level: 0, status: 'available' as const },
      { skillId: 'dependent', level: 0, status: 'locked' as const },
    ];
    const prerequisites = [{ skillId: 'dependent', prerequisiteSkillId: 'prereq' }];

    const recomputed = recomputeStatuses(allSkills, prerequisites);
    const dep = recomputed.find((s) => s.skillId === 'dependent')!;
    expect(dep.status).toBe('locked');
  });

  it('does NOT modify acquired, struggling, or in_progress skills', () => {
    const allSkills = [
      { skillId: 'prereq', level: 0, status: 'available' as const },
      { skillId: 's-acquired', level: 2, status: 'acquired' as const },
      { skillId: 's-struggling', level: 1, status: 'struggling' as const },
      { skillId: 's-inprogress', level: 1, status: 'in_progress' as const },
    ];
    const prerequisites = [
      { skillId: 's-acquired', prerequisiteSkillId: 'prereq' },
      { skillId: 's-struggling', prerequisiteSkillId: 'prereq' },
      { skillId: 's-inprogress', prerequisiteSkillId: 'prereq' },
    ];

    const recomputed = recomputeStatuses(allSkills, prerequisites);
    expect(recomputed.find((s) => s.skillId === 's-acquired')?.status).toBe('acquired');
    expect(recomputed.find((s) => s.skillId === 's-struggling')?.status).toBe('struggling');
    expect(recomputed.find((s) => s.skillId === 's-inprogress')?.status).toBe('in_progress');
  });
});

describe('SPEC-004 domain: needsReplan', () => {
  it('returns true if any skill level changed', () => {
    const before = [{ skillId: 's1', level: 3, status: 'acquired' as const }];
    const after = [{ skillId: 's1', level: 2, status: 'available' as const }];
    expect(needsReplan(before, after)).toBe(true);
  });

  it('returns true if a skill status changed to struggling or available', () => {
    const before = [{ skillId: 's1', level: 1, status: 'in_progress' as const }];
    const after = [{ skillId: 's1', level: 1, status: 'struggling' as const }];
    expect(needsReplan(before, after)).toBe(true);
  });

  it('returns false for a passed verification where level and status stay identical', () => {
    const before = [{ skillId: 's1', level: 2, status: 'acquired' as const }];
    const after = [{ skillId: 's1', level: 2, status: 'acquired' as const }];
    expect(needsReplan(before, after)).toBe(false);
  });
});

describe('SPEC-004 domain: shouldReplanForSkippedActivities', () => {
  it('returns false when skipped count is less than threshold (2)', () => {
    expect(shouldReplanForSkippedActivities(0)).toBe(false);
    expect(shouldReplanForSkippedActivities(1)).toBe(false);
  });

  it('returns true when skipped count is >= 2', () => {
    expect(shouldReplanForSkippedActivities(2)).toBe(true);
    expect(shouldReplanForSkippedActivities(3)).toBe(true);
  });
});

describe('SPEC-004 domain: computeJourneyChanges', () => {
  const baseOldSkeleton: JourneySkeleton = {
    weeks: [],
    scheduledSkills: [
      {
        skillId: 's1',
        skillSlug: 'sql',
        name: 'SQL',
        currentLevel: 1,
        targetLevel: 3,
        reinforcement: false,
        totalScheduledMinutes: 300,
        slots: [
          {
            slotId: 'slot-1',
            skillId: 's1',
            skillSlug: 'sql',
            week: 1,
            type: 'resource',
            minutes: 120,
            resource: { id: 'res-sql-1', title: 'SQL Basics', url: '', type: 'course' },
          },
        ],
      },
    ],
    backlog: [],
    studyOrder: ['sql'],
  };

  it('detects skill_added when a new skill enters the plan', () => {
    const newSkeleton: JourneySkeleton = {
      ...baseOldSkeleton,
      scheduledSkills: [
        ...baseOldSkeleton.scheduledSkills,
        {
          skillId: 's2',
          skillSlug: 'python',
          name: 'Python',
          currentLevel: 0,
          targetLevel: 2,
          reinforcement: false,
          totalScheduledMinutes: 300,
          slots: [],
        },
      ],
    };

    const changes = computeJourneyChanges(baseOldSkeleton, newSkeleton);
    const added = changes.find((c) => c.type === 'skill_added');
    expect(added).toBeDefined();
    expect(added?.skillSlug).toBe('python');
  });

  it('detects skill_removed when a skill leaves the active schedule', () => {
    const newSkeleton: JourneySkeleton = {
      weeks: [],
      scheduledSkills: [],
      backlog: [],
      studyOrder: [],
    };

    const changes = computeJourneyChanges(baseOldSkeleton, newSkeleton);
    const removed = changes.find((c) => c.type === 'skill_removed');
    expect(removed).toBeDefined();
    expect(removed?.skillSlug).toBe('sql');
  });

  it('detects reinforcement_added when skill is rescheduled with reinforcement', () => {
    const newSkeleton: JourneySkeleton = {
      ...baseOldSkeleton,
      scheduledSkills: [
        {
          ...baseOldSkeleton.scheduledSkills[0],
          reinforcement: true,
        },
      ],
    };

    const changes = computeJourneyChanges(baseOldSkeleton, newSkeleton);
    const reinforcement = changes.find((c) => c.type === 'reinforcement_added');
    expect(reinforcement).toBeDefined();
    expect(reinforcement?.skillSlug).toBe('sql');
  });

  it('detects resource_swapped when assigned resource ID changes', () => {
    const newSkeleton: JourneySkeleton = {
      ...baseOldSkeleton,
      scheduledSkills: [
        {
          ...baseOldSkeleton.scheduledSkills[0],
          slots: [
            {
              ...baseOldSkeleton.scheduledSkills[0].slots[0],
              resource: { id: 'res-sql-alternate', title: 'Interactive SQL', url: '', type: 'practice' },
            },
          ],
        },
      ],
    };

    const changes = computeJourneyChanges(baseOldSkeleton, newSkeleton);
    const swapped = changes.find((c) => c.type === 'resource_swapped');
    expect(swapped).toBeDefined();
    expect(swapped?.skillSlug).toBe('sql');
  });

  it('detects time_reallocated when total scheduled minutes change', () => {
    const newSkeleton: JourneySkeleton = {
      ...baseOldSkeleton,
      scheduledSkills: [
        {
          ...baseOldSkeleton.scheduledSkills[0],
          totalScheduledMinutes: 450,
        },
      ],
    };

    const changes = computeJourneyChanges(baseOldSkeleton, newSkeleton);
    const reallocated = changes.find((c) => c.type === 'time_reallocated');
    expect(reallocated).toBeDefined();
    expect(reallocated?.skillSlug).toBe('sql');
  });

  it('orders changes deterministically by skillSlug then type', () => {
    const changes = computeJourneyChanges(
      baseOldSkeleton,
      {
        weeks: [],
        scheduledSkills: [
          {
            skillId: 's-b',
            skillSlug: 'b-skill',
            name: 'B Skill',
            currentLevel: 0,
            targetLevel: 1,
            reinforcement: false,
            totalScheduledMinutes: 300,
            slots: [],
          },
          {
            skillId: 's-a',
            skillSlug: 'a-skill',
            name: 'A Skill',
            currentLevel: 0,
            targetLevel: 1,
            reinforcement: false,
            totalScheduledMinutes: 300,
            slots: [],
          },
        ],
        backlog: [],
        studyOrder: [],
      }
    );

    expect(changes[0].skillSlug).toBe('a-skill');
    expect(changes[1].skillSlug).toBe('b-skill');
    expect(changes[2].skillSlug).toBe('sql');
  });
});
