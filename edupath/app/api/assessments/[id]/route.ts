// app/api/assessments/[id]/route.ts
// HTTP route handler for GET /api/assessments/:id (SPEC-004 §3.5)

import { NextRequest, NextResponse } from 'next/server';
import { getAssessment, AssessmentServiceError } from '@/services/assessment';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
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

    const result = await getAssessment(id);
    return NextResponse.json(result);
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
        error: 'Failed to retrieve assessment',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
