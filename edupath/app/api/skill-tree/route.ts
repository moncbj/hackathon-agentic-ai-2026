// app/api/skill-tree/route.ts
// HTTP route handler for GET /api/skill-tree (SPEC-002)

import { NextResponse } from 'next/server';
import { getSkillTreeData, SkillTreeError } from '@/services/skill-tree';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getSkillTreeData();
    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof SkillTreeError) {
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
        error: 'Failed to retrieve skill tree data',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
