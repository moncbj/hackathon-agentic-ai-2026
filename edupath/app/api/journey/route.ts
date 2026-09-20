// app/api/journey/route.ts
// HTTP route handler for GET /api/journey (SPEC-003)

import { NextResponse } from 'next/server';
import { getActiveJourneyData, JourneyServiceError } from '@/services/journey';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const journey = await getActiveJourneyData();
    return NextResponse.json(journey, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof JourneyServiceError) {
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
        error: 'Failed to retrieve active learning journey',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
