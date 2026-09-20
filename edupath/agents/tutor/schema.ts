// agents/tutor/schema.ts
// Zod schemas and validation contracts for Tutor Agent (SPEC-005 §3.1, §3.2)

import { z } from 'zod';
import { TONE_VALUES, DETAIL_LEVEL_VALUES, VERIFICATION_VALUES, STATUS_VALUES } from '@/domain/constants';

// ==========================================
// Tutor Style Schema
// ==========================================

export const TutorStyleSchema = z.object({
  language: z.string().default('es'),
  tone: z.enum(TONE_VALUES).default('cercano'),
  detailLevel: z.enum(DETAIL_LEVEL_VALUES).default('equilibrado'),
  useAnalogies: z.boolean().default(true),
  freeInstructions: z.string().max(500).optional(),
});

export type TutorStyle = z.infer<typeof TutorStyleSchema>;

// ==========================================
// Tutor Chat Schemas
// ==========================================

export const SnapshotSkillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(4),
  requiredLevel: z.number().int().min(0).max(4),
  verification: z.enum(VERIFICATION_VALUES),
  status: z.enum(STATUS_VALUES),
  progress: z.number().int().min(0).max(100),
});

export const SnapshotActivitySchema = z.object({
  title: z.string(),
  type: z.string(),
  status: z.string(),
  skillSlug: z.string(),
});

export const SnapshotCurrentWeekSchema = z.object({
  number: z.number().int().min(1),
  activities: z.array(SnapshotActivitySchema),
});

export const SnapshotLastChangeSchema = z.object({
  summary: z.string(),
  changes: z.unknown().optional(),
});

export const TutorSnapshotSchema = z.object({
  name: z.string(),
  role: z.string(),
  weeklyHours: z.number(),
  skills: z.array(SnapshotSkillSchema),
  currentWeek: SnapshotCurrentWeekSchema.optional().nullable(),
  lastChange: SnapshotLastChangeSchema.optional().nullable(),
});

export const TutorNotebookItemSchema = z.object({
  title: z.string().max(80),
  content: z.string().max(4000),
});

export const ChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(1000),
});

export const TutorChatInputSchema = z.object({
  tutorStyle: TutorStyleSchema,
  snapshot: TutorSnapshotSchema,
  notebooks: z.array(TutorNotebookItemSchema).max(2).optional().default([]),
  history: z.array(ChatTurnSchema).max(10).default([]),
  question: z.string().min(1).max(1000),
});

export type TutorChatInput = z.infer<typeof TutorChatInputSchema>;

export const SuggestedActionTypeSchema = z.enum([
  'start_assessment',
  'open_skill',
  'open_journey',
  'open_notebook',
]);

export const SuggestedActionSchema = z.object({
  type: SuggestedActionTypeSchema,
  skillSlug: z.string().optional(),
  notebookId: z.string().optional(),
});

export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export const TutorChatOutputSchema = z.object({
  answer: z.string().min(1).max(1500),
  followUps: z.array(z.string().max(200)).min(0).max(3).default([]),
  suggestedAction: SuggestedActionSchema.optional(),
});

export type TutorChatOutput = z.infer<typeof TutorChatOutputSchema>;

// ==========================================
// Tutor Report Schemas
// ==========================================

export const ReportCandidateItemSchema = z.object({
  candidateId: z.string().min(1),
  title: z.string(),
  actionType: SuggestedActionTypeSchema,
  skillSlug: z.string().optional(),
  defaultText: z.string(),
});

export const TutorReportDataSchema = z.object({
  acquired: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    level: z.number(),
    verification: z.enum(VERIFICATION_VALUES),
  })),
  inProgress: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    level: z.number(),
    requiredLevel: z.number(),
    progress: z.number(),
  })),
  struggling: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    level: z.number(),
    requiredLevel: z.number(),
    consecutiveFailures: z.number(),
  })),
  remainingGaps: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    level: z.number(),
    requiredLevel: z.number(),
    gap: z.number(),
    priority: z.number(),
  })),
  toVerify: z.array(z.object({
    slug: z.string(),
    name: z.string(),
    level: z.number(),
    weight: z.number(),
  })),
  activity: z.object({
    completedThisWeek: z.number(),
    totalThisWeek: z.number(),
    completedOverall: z.number(),
    skippedOverall: z.number(),
  }),
  assessments: z.object({
    totalCount: z.number(),
    lastThree: z.array(z.object({
      skill: z.string(),
      score: z.number(),
      date: z.string(),
    })),
  }),
  journey: z.object({
    currentVersion: z.number(),
    latestChangeSummary: z.string(),
  }),
  nextStepCandidates: z.array(ReportCandidateItemSchema).min(1).max(5),
});

export type TutorReportData = z.infer<typeof TutorReportDataSchema>;

export const TutorReportInputSchema = z.object({
  tutorStyle: TutorStyleSchema,
  reportData: TutorReportDataSchema,
});

export type TutorReportInput = z.infer<typeof TutorReportInputSchema>;

export const ReportNextStepItemSchema = z.object({
  candidateId: z.string().min(1),
  text: z.string().min(1).max(150),
});

export const TutorReportOutputSchema = z.object({
  headline: z.string().min(1).max(100),
  narrative: z.string().min(1).max(700),
  nextSteps: z.array(ReportNextStepItemSchema).min(1).max(5),
});

export type TutorReportOutput = z.infer<typeof TutorReportOutputSchema>;
