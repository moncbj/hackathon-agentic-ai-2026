// app/api/activities/[id]/skip/route.ts
// HTTP route handler for POST /api/activities/:id/skip (SPEC-003)

import { NextResponse } from 'next/server';
import { skipActivity, JourneyServiceError } from '@/services/journey';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Activity ID is required', code: 'ACTIVITY_NOT_FOUND' },
        { status: 400 }
      );
    }

    const result = await skipActivity(id);
    return NextResponse.json(result, { status: 200 });
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
        error: 'Failed to skip activity',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
