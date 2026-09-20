// app/api/notebooks/[id]/route.ts
// HTTP route handler for GET, PATCH, DELETE /api/notebooks/:id (SPEC-005 §3.4)

import { NextRequest, NextResponse } from 'next/server';
import { getNotebook, updateNotebook, deleteNotebook, NotebookServiceError } from '@/services/notebooks';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Notebook ID is required', code: 'NOTEBOOK_NOT_FOUND' },
        { status: 400 }
      );
    }

    const notebook = await getNotebook(id);
    return NextResponse.json(notebook, { status: 200 });
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
        error: 'Failed to retrieve notebook',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Notebook ID is required', code: 'NOTEBOOK_NOT_FOUND' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { title, content, skillIds } = body;

    const updated = await updateNotebook(id, {
      title,
      content,
      skillIds,
    });

    return NextResponse.json(updated, { status: 200 });
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
        error: 'Failed to update notebook',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'Notebook ID is required', code: 'NOTEBOOK_NOT_FOUND' },
        { status: 400 }
      );
    }

    const result = await deleteNotebook(id);
    return NextResponse.json(result, { status: 200 });
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
        error: 'Failed to delete notebook',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
