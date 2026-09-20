// app/api/journey/generate/route.ts
// HTTP route handler for POST /api/journey/generate (SPEC-003)

import { NextResponse } from 'next/server';
import { generateInitialJourney, JourneyServiceError } from '@/services/journey';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const journey = await generateInitialJourney();
    return NextResponse.json(journey, { status: 201 });
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
        error: 'Failed to generate learning journey',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
