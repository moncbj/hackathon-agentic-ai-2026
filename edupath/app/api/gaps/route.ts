// app/api/gaps/route.ts
// HTTP route handler for GET /api/gaps (SPEC-002)

import { NextResponse } from 'next/server';
import { getGapAnalysisAndExplanation, GapsServiceError } from '@/services/gaps';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getGapAnalysisAndExplanation();
    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof GapsServiceError) {
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
        error: 'Failed to retrieve gap analysis',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
