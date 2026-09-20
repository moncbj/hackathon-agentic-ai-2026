// app/api/tutor/chat/route.ts
// HTTP route handler for POST /api/tutor/chat (SPEC-005 §3.4)

import { NextRequest, NextResponse } from 'next/server';
import { handleTutorChat, TutorServiceError } from '@/services/tutor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { question, history, focusSkillSlug, notebookIds } = body;

    const result = await handleTutorChat({
      question,
      history,
      focusSkillSlug,
      notebookIds,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof TutorServiceError) {
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
        error: 'Failed to process tutor chat request',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
