import { NextResponse } from 'next/server';
import { z } from 'zod';
import { countSeededRoles } from '@/lib/db/repositories/roles';
import { generateStructured } from '@/lib/gemini/generate-structured';

export const dynamic = 'force-dynamic';

const HealthCheckSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
});

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'error';
  let seededRolesCount = 0;

  // 1. Check Database connection & count seeded roles
  try {
    seededRolesCount = await countSeededRoles();
    dbStatus = 'ok';
  } catch {
    // Expected when running without Supabase credentials locally
    dbStatus = 'error';
    seededRolesCount = 0;
  }

  // 2. Check AI layer status
  let aiStatus: 'ok' | 'fixtures' | 'error' = 'error';
  const aiMode = process.env.AI_MODE || 'fixtures';

  if (aiMode === 'fixtures') {
    try {
      await generateStructured({
        schema: HealthCheckSchema,
        systemPrompt: 'System health check verification.',
        input: 'ping',
        fixtureKey: 'health-check',
      });
      aiStatus = 'fixtures';
    } catch {
      aiStatus = 'error';
    }
  } else {
    try {
      await generateStructured({
        schema: HealthCheckSchema,
        systemPrompt: 'You are a health check system. Return JSON { "status": "ok" }',
        input: 'ping',
        fixtureKey: 'health-check',
        timeout: 10000,
      });
      aiStatus = 'ok';
    } catch {
      aiStatus = 'error';
    }
  }

  return NextResponse.json({
    db: dbStatus,
    ai: aiStatus,
    seededRoles: seededRolesCount,
  });
}
