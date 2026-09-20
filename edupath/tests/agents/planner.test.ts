import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPlannerAgent } from '@/agents/planner/run';
import {
  PlannerAgentInput,
  PlannerAgentOutputSchema,
} from '@/agents/planner/schema';

describe('SPEC-003: Learning Planner Agent', () => {
  const sampleInput: PlannerAgentInput = {
    learner: {
      name: 'Alex',
      background: 'Studied economics',
      weeklyHours: 5,
    },
    tutorStyle: {
      language: 'es',
      tone: 'cercano',
      detailLevel: 'equilibrado',
      useAnalogies: true,
      freeInstructions: 'Enfocarse en finanzas',
    },
    skills: [
      {
        skillSlug: 'sql',
        name: 'SQL',
        currentLevel: 0,
        targetLevel: 2,
        reinforcement: false,
        slots: [
          { slotId: 'slot-w1-sql-resource-1', type: 'resource', week: 1, minutes: 120, resource: { title: 'SQL Guide', type: 'course' } },
          { slotId: 'slot-w1-sql-practice-1', type: 'practice', week: 1, minutes: 180 },
        ],
      },
      {
        skillSlug: 'spreadsheets',
        name: 'Spreadsheets',
        currentLevel: 0,
        targetLevel: 1,
        reinforcement: false,
        slots: [
          { slotId: 'slot-w2-spreadsheets-resource-1', type: 'resource', week: 2, minutes: 120 },
          { slotId: 'slot-w2-spreadsheets-practice-1', type: 'practice', week: 2, minutes: 180 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.stubEnv('AI_MODE', 'fixtures');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads and validates the planner fixture successfully', async () => {
    const output = await runPlannerAgent(sampleInput);

    expect(output).toBeDefined();
    expect(output.objectives.length).toBeGreaterThanOrEqual(2);
    expect(output.activities.length).toBeGreaterThanOrEqual(4);
    expect(output.weeklySummaries.length).toBeGreaterThanOrEqual(2);

    // Schema validation
    const parsed = PlannerAgentOutputSchema.safeParse(output);
    expect(parsed.success).toBe(true);
  });

  it('validates text length constraints on objectives and activities', async () => {
    const output = await runPlannerAgent(sampleInput);

    for (const obj of output.objectives) {
      expect(obj.description.length).toBeLessThanOrEqual(250);
      expect(obj.masteryCriteria.length).toBeGreaterThanOrEqual(1);
      expect(obj.masteryCriteria.length).toBeLessThanOrEqual(3);
    }

    for (const act of output.activities) {
      expect(act.title.length).toBeLessThanOrEqual(80);
      expect(act.mission.length).toBeGreaterThan(0);
      expect(act.successCriteria.length).toBeGreaterThan(0);
    }

    for (const summary of output.weeklySummaries) {
      expect(summary.headline.length).toBeLessThanOrEqual(100);
      expect(summary.note.length).toBeLessThanOrEqual(500);
    }
  });

  it('rejects an activity with missing slotId or empty title', () => {
    const invalidActivity = {
      slotId: '',
      title: 'Valid Title',
      mission: 'Some mission',
      successCriteria: 'Done',
    };
    const parsed = PlannerAgentOutputSchema.safeParse({
      objectives: [],
      activities: [invalidActivity],
      weeklySummaries: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an objective with description exceeding 250 characters', () => {
    const invalidObjective = {
      skillSlug: 'sql',
      description: 'x'.repeat(251),
      masteryCriteria: ['Test'],
    };
    const parsed = PlannerAgentOutputSchema.safeParse({
      objectives: [invalidObjective],
      activities: [],
      weeklySummaries: [],
    });
    expect(parsed.success).toBe(false);
  });
});
