// app/api/notebooks/route.ts
// HTTP route handler for GET /api/notebooks and POST /api/notebooks (SPEC-005 §3.4)

import { NextRequest, NextResponse } from 'next/server';
import { listNotebooks, createNotebook, NotebookServiceError } from '@/services/notebooks';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const notebooks = await listNotebooks();
    return NextResponse.json(notebooks, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof NotebookServiceError) {
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
        error: 'Failed to list notebooks',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, content, skillIds } = body;

    const notebook = await createNotebook({
      title,
      content,
      skillIds,
    });

    return NextResponse.json(notebook, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof NotebookServiceError) {
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
        error: 'Failed to create notebook',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
