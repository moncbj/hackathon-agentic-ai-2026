// app/api/journey/replan/route.ts
// HTTP route handler for POST /api/journey/replan (SPEC-004 §3.5)

import { NextRequest, NextResponse } from 'next/server';
import { executeReplan, ReplanServiceError } from '@/services/replan';
import { JourneyReason } from '@/domain/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reason = body?.reason as JourneyReason;

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'Missing "reason" in request body' },
        { status: 400 }
      );
    }

    if (reason !== 'assessment' && reason !== 'skipped_activities') {
      return NextResponse.json(
        {
          error: `Invalid replan reason: "${reason}". Only "assessment" and "skipped_activities" are supported.`,
          code: 'INVALID_REASON',
        },
        { status: 409 }
      );
    }

    const result = await executeReplan(reason);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ReplanServiceError) {
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
        error: 'Failed to replan learning journey',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
