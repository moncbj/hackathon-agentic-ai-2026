// agents/planner/schema.ts
// Zod schemas for Learning Planner Agent input and output (SPEC-003 §3.2)

import { z } from 'zod';

export const PlannerSlotInputSchema = z.object({
  slotId: z.string().min(1).max(100),
  type: z.enum(['resource', 'practice', 'project']),
  week: z.number().int().min(1).max(52),
  minutes: z.number().int().min(15),
  resource: z
    .object({
      title: z.string().min(1).max(200),
      type: z.string().min(1).max(50),
    })
    .optional(),
});

export type PlannerSlotInput = z.infer<typeof PlannerSlotInputSchema>;

export const PlannerSkillInputSchema = z.object({
  skillSlug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  currentLevel: z.number().int().min(0).max(4),
  targetLevel: z.number().int().min(1).max(4),
  reinforcement: z.boolean(),
  slots: z.array(PlannerSlotInputSchema),
});

export type PlannerSkillInput = z.infer<typeof PlannerSkillInputSchema>;

export const PlannerAgentInputSchema = z.object({
  learner: z.object({
    name: z.string().min(1).max(100),
    background: z.string().max(2000),
    weeklyHours: z.number().int().min(1).max(40),
  }),
  tutorStyle: z.object({
    language: z.string().default('es'),
    tone: z.string().default('cercano'),
    detailLevel: z.string().default('equilibrado'),
    useAnalogies: z.boolean().default(true),
    freeInstructions: z.string().default(''),
  }),
  skills: z.array(PlannerSkillInputSchema),
  changeContext: z
    .object({
      reason: z.string(),
      changes: z.unknown().optional(),
    })
    .optional(),
});

export type PlannerAgentInput = z.infer<typeof PlannerAgentInputSchema>;

export const PlannerObjectiveSchema = z.object({
  skillSlug: z.string().min(1).max(100),
  description: z.string().min(1).max(250),
  masteryCriteria: z.array(z.string().min(1).max(300)).min(1).max(3),
});

export type PlannerObjective = z.infer<typeof PlannerObjectiveSchema>;

export const PlannerActivitySchema = z.object({
  slotId: z.string().min(1).max(100),
  title: z.string().min(1).max(80),
  mission: z.string().min(1).max(1000),
  instructions: z.string().max(1500).optional().default(''),
  successCriteria: z.string().min(1).max(500),
});

export type PlannerActivity = z.infer<typeof PlannerActivitySchema>;

export const PlannerWeeklySummarySchema = z.object({
  week: z.number().int().min(1).max(52),
  headline: z.string().min(1).max(100),
  note: z.string().min(1).max(500),
});

export type PlannerWeeklySummary = z.infer<typeof PlannerWeeklySummarySchema>;

export const PlannerAgentOutputSchema = z.object({
  objectives: z.array(PlannerObjectiveSchema),
  activities: z.array(PlannerActivitySchema),
  weeklySummaries: z.array(PlannerWeeklySummarySchema),
  changeExplanation: z.string().max(500).optional(),
});

export type PlannerAgentOutput = z.infer<typeof PlannerAgentOutputSchema>;
