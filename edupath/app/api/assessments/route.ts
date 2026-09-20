// app/api/assessments/route.ts
// HTTP route handler for POST /api/assessments (SPEC-004 §3.5)

import { NextRequest, NextResponse } from 'next/server';
import { generateAssessment, AssessmentServiceError } from '@/services/assessment';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const skillSlug = body?.skillSlug;

    if (!skillSlug || typeof skillSlug !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "skillSlug" field in request body' },
        { status: 400 }
      );
    }

    const result = await generateAssessment(skillSlug.trim());
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AssessmentServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
        },
        { status: err.status }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate assessment',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
