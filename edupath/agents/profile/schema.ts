// agents/profile/schema.ts
// Zod schemas for the Profile Agent input and output (SPEC-001)

import { z } from 'zod';

export const ProfileAgentInputSchema = z.object({
  documentText: z.string().min(1).max(20000),
  roleSkills: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
    })
  ),
  declaredLevels: z.record(z.string(), z.number().int().min(0).max(4)).optional(),
});

export type ProfileAgentInput = z.infer<typeof ProfileAgentInputSchema>;

export const ProposedSkillSchema = z.object({
  skillSlug: z.string(),
  proposedLevel: z.number().int().min(0).max(4),
  rationale: z.string().max(200),
  confidence: z.enum(['low', 'medium', 'high']),
});

export type ProposedSkill = z.infer<typeof ProposedSkillSchema>;

export const UnmappedSkillSchema = z.object({
  name: z.string(),
  proposedLevel: z.number().int().min(0).max(4),
  rationale: z.string().max(200),
});

export type UnmappedSkill = z.infer<typeof UnmappedSkillSchema>;

export const ProfileAgentOutputSchema = z.object({
  proposedSkills: z.array(ProposedSkillSchema),
  unmappedSkills: z.array(UnmappedSkillSchema),
  summary: z.string().max(400),
});

export type ProfileAgentOutput = z.infer<typeof ProfileAgentOutputSchema>;
