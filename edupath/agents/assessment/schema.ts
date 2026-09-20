// agents/assessment/schema.ts
// Zod schemas and validation rules for the Assessment Agent (SPEC-004 §3.2)

import { z } from 'zod';

// ==========================================
// Assessment Generation Schemas
// ==========================================

export const QuestionOptionSchema = z.object({
  id: z.string().min(1).max(50),
  text: z.string().min(1).max(500),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const RubricCriterionSchema = z.object({
  description: z.string().min(1).max(300),
  points: z.number().positive(),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const QuestionRubricSchema = z.object({
  criteria: z.array(RubricCriterionSchema).min(1).max(5),
  maxPoints: z.number().positive(),
});

export type QuestionRubric = z.infer<typeof QuestionRubricSchema>;

export const AssessmentQuestionItemSchema = z
  .object({
    id: z.string().min(1).max(50),
    type: z.enum(['multiple_choice', 'short_answer']),
    prompt: z.string().min(5).max(1000),
    options: z.array(QuestionOptionSchema).optional(),
    correctOptionId: z.string().optional(),
    rubric: QuestionRubricSchema.optional(),
    explanation: z.string().min(5).max(1000),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'multiple_choice') {
      if (!val.options || val.options.length !== 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple choice questions must have exactly 4 options',
          path: ['options'],
        });
      }
      if (!val.correctOptionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple choice questions must define a correctOptionId',
          path: ['correctOptionId'],
        });
      } else if (val.options && !val.options.some((opt) => opt.id === val.correctOptionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'correctOptionId must reference an existing option id',
          path: ['correctOptionId'],
        });
      }
    } else if (val.type === 'short_answer') {
      if (!val.rubric) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Short answer questions must provide a rubric',
          path: ['rubric'],
        });
      } else {
        const sumPoints = val.rubric.criteria.reduce((sum, c) => sum + c.points, 0);
        // Allow tiny floating point tolerance (0.01)
        if (Math.abs(sumPoints - val.rubric.maxPoints) > 0.01) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Rubric criteria points sum (${sumPoints}) must equal maxPoints (${val.rubric.maxPoints})`,
            path: ['rubric', 'maxPoints'],
          });
        }
      }
    }
  });

export type AssessmentQuestionItem = z.infer<typeof AssessmentQuestionItemSchema>;

export const AssessmentGenerateInputSchema = z.object({
  skill: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(''),
  }),
  targetLevel: z.number().int().min(1).max(4),
  levelDescription: z.string().min(1),
  language: z.string().default('es'),
  mix: z
    .object({
      multipleChoice: z.literal(3),
      shortAnswer: z.literal(2),
    })
    .default({
      multipleChoice: 3,
      shortAnswer: 2,
    }),
  previousPrompts: z.array(z.string()).default([]),
});

export type AssessmentGenerateInput = z.infer<typeof AssessmentGenerateInputSchema>;

export const AssessmentGenerateOutputSchema = z
  .object({
    questions: z.array(AssessmentQuestionItemSchema),
  })
  .superRefine((val, ctx) => {
    if (val.questions.length !== 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Must contain exactly 5 questions, received ${val.questions.length}`,
        path: ['questions'],
      });
      return;
    }

    const mcqCount = val.questions.filter((q) => q.type === 'multiple_choice').length;
    const saCount = val.questions.filter((q) => q.type === 'short_answer').length;

    if (mcqCount !== 3 || saCount !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Must contain exactly 3 multiple_choice and 2 short_answer questions (got ${mcqCount} MCQ, ${saCount} SA)`,
        path: ['questions'],
      });
    }

    // Check unique question IDs
    const ids = new Set<string>();
    for (const q of val.questions) {
      if (ids.has(q.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate question id found: "${q.id}"`,
          path: ['questions'],
        });
      }
      ids.add(q.id);
    }
  });

export type AssessmentGenerateOutput = z.infer<typeof AssessmentGenerateOutputSchema>;

// ==========================================
// Assessment Grading Schemas
// ==========================================

export const GradeItemInputSchema = z.object({
  questionId: z.string().min(1),
  prompt: z.string().min(1),
  rubric: QuestionRubricSchema,
  answer: z.string(),
});

export type GradeItemInput = z.infer<typeof GradeItemInputSchema>;

export const AssessmentGradeInputSchema = z.object({
  skill: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  targetLevel: z.number().int().min(1).max(4),
  items: z.array(GradeItemInputSchema).min(1).max(5),
  language: z.string().default('es'),
});

export type AssessmentGradeInput = z.infer<typeof AssessmentGradeInputSchema>;

export const GradeItemResultSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().min(0).max(1),
  feedback: z.string().max(300),
});

export type GradeItemResult = z.infer<typeof GradeItemResultSchema>;

export const AssessmentGradeOutputSchema = z.object({
  items: z.array(GradeItemResultSchema),
  overallFeedback: z.string().max(400),
  strugglesWith: z.array(z.string().min(1).max(100)).max(5),
});

export type AssessmentGradeOutput = z.infer<typeof AssessmentGradeOutputSchema>;

// ==========================================
// Client Sanitization (Privacy / Anti-Leak)
// ==========================================

export interface SanitizedQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer';
  prompt: string;
  options?: Array<{ id: string; text: string }>;
}

/**
 * Strips confidential answer keys, rubrics, and explanations from questions.
 * SPEC-004 §3.2:
 * The browser MUST NOT receive correctOptionId, rubric, or explanation
 * until after the assessment is submitted and graded.
 */
export function stripSecrets(questions: AssessmentQuestionItem[]): SanitizedQuestion[] {
  return questions.map((q) => {
    if (q.type === 'multiple_choice') {
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: (q.options || []).map((opt) => ({
          id: opt.id,
          text: opt.text,
        })),
      };
    }
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
    };
  });
}
