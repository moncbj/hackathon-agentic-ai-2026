// agents/gap-analysis/schema.ts
// Zod schemas for the Gap Analysis Agent input and output (SPEC-002)

import { z } from 'zod';

export const GapItemSchema = z.object({
  skillSlug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  level: z.number().int().min(0).max(4),
  requiredLevel: z.number().int().min(0).max(4),
  gap: z.number().int().min(0).max(4),
  priority: z.number().nonnegative(),
});

export type GapItem = z.infer<typeof GapItemSchema>;

export const ToVerifyItemSchema = z.object({
  skillSlug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  level: z.number().int().min(0).max(4),
});

export type ToVerifyItem = z.infer<typeof ToVerifyItemSchema>;

export const TutorStyleInputSchema = z.object({
  language: z.string().min(1).max(20),
  tone: z.string().min(1).max(50),
  detailLevel: z.string().min(1).max(50),
  useAnalogies: z.boolean(),
  freeInstructions: z.string().max(500),
});

export type TutorStyleInput = z.infer<typeof TutorStyleInputSchema>;

export const GapAnalysisAgentInputSchema = z.object({
  role: z.object({
    name: z.string().min(1).max(200),
  }),
  gaps: z.array(GapItemSchema),
  toVerify: z.array(ToVerifyItemSchema),
  tutorStyle: TutorStyleInputSchema,
});

export type GapAnalysisAgentInput = z.infer<typeof GapAnalysisAgentInputSchema>;

export const GapExplanationSkillSchema = z.object({
  skillSlug: z.string().min(1).max(100),
  explanation: z.string().max(250),
  whyItMatters: z.string().max(200),
});

export type GapExplanationSkill = z.infer<typeof GapExplanationSkillSchema>;

export const GapAnalysisAgentOutputSchema = z.object({
  summary: z.string().min(1).max(500),
  perSkill: z.array(GapExplanationSkillSchema),
  recommendedFocus: z.array(z.string().min(1).max(100)).max(3),
});

export type GapAnalysisAgentOutput = z.infer<typeof GapAnalysisAgentOutputSchema>;
