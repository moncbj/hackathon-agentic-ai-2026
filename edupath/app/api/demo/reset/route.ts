import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { clearLearnerData, runSeed, SeedDataset } from '@/lib/db/repositories/seed';

export const dynamic = 'force-dynamic';

export async function POST() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDemoMode = process.env.DEMO_MODE === 'true';

  // Security guard: In production, demo reset is strictly blocked unless DEMO_MODE="true"
  if (isProduction && !isDemoMode) {
    return NextResponse.json(
      {
        error: 'Forbidden: Demo reset is disabled in production unless DEMO_MODE=true.',
      },
      { status: 403 }
    );
  }

  try {
    // 1. Clear learner data in reverse dependency order
    await clearLearnerData();

    // 2. Re-seed reference catalog idempotently
    const seedDir = path.join(process.cwd(), 'data', 'seed');
    const roles = JSON.parse(fs.readFileSync(path.join(seedDir, 'roles.json'), 'utf-8'));
    const skills = JSON.parse(fs.readFileSync(path.join(seedDir, 'skills.json'), 'utf-8'));
    const roleSkills = JSON.parse(fs.readFileSync(path.join(seedDir, 'role-skills.json'), 'utf-8'));
    const prerequisites = JSON.parse(
      fs.readFileSync(path.join(seedDir, 'skill-prerequisites.json'), 'utf-8')
    );
    const resources = JSON.parse(
      fs.readFileSync(path.join(seedDir, 'resources.json'), 'utf-8')
    );

    const dataset: SeedDataset = {
      roles,
      skills,
      roleSkills,
      prerequisites,
      resources,
    };

    const seedSummary = await runSeed(dataset);

    return NextResponse.json({
      success: true,
      message: 'Demo reset completed successfully.',
      seedSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: 'Failed to execute demo reset.',
        details: message,
      },
      { status: 500 }
    );
  }
}
