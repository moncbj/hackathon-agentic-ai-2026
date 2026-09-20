// app/api/assessments/[id]/submit/route.ts
// HTTP route handler for POST /api/assessments/:id/submit (SPEC-004 §3.5)

import { NextRequest, NextResponse } from 'next/server';
import { submitAssessment, AssessmentServiceError } from '@/services/assessment';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing assessment ID parameter' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const answers = body?.answers;

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Missing or invalid "answers" map in request body' },
        { status: 400 }
      );
    }

    const result = await submitAssessment(id, answers);
    return NextResponse.json(result, { status: 200 });
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
        error: 'Failed to submit assessment',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
