// app/api/onboarding/route.ts
// HTTP handler for learner onboarding (SPEC-001)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOnboarding, OnboardingError } from '@/services/onboarding';

export const dynamic = 'force-dynamic';

const OnboardingRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters'),
  background: z.string().max(2000, 'Background must not exceed 2000 characters').default(''),
  targetRoleId: z.string().uuid('Invalid target role UUID format'),
  weeklyHours: z
    .number()
    .int('Weekly hours must be an integer')
    .min(1, 'Weekly hours must be between 1 and 40')
    .max(40, 'Weekly hours must be between 1 and 40'),

  declaredLevels: z.record(z.string(), z.number().int().min(0).max(4)).optional().default({}),
  extraSkills: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Skill name cannot be empty').max(100),
        level: z.number().int().min(0).max(4),
      })
    )
    .optional()
    .default([]),
  tutorStyle: z.object({
    language: z.string().default('es'),
    tone: z.enum(['formal', 'cercano', 'motivador']),
    detailLevel: z.enum(['resumido', 'equilibrado', 'profundo']),
    useAnalogies: z.boolean(),
    freeInstructions: z.string().max(500, 'Free instructions must not exceed 500 characters').default(''),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body in request' },
      { status: 400 }
    );
  }

  const parsed = OnboardingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  try {
    const result = await createOnboarding(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof OnboardingError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: err.details,
        },
        { status: err.status }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to complete onboarding',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
