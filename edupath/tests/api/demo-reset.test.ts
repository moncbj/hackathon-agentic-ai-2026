import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/demo/reset/route';
import * as seedRepo from '@/lib/db/repositories/seed';

describe('API: POST /api/demo/reset', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 403 Forbidden in production when DEMO_MODE is not true', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.DEMO_MODE;

    const response = await POST();
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toContain('Forbidden');
  });

  it('should allow demo reset in production when DEMO_MODE="true"', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';

    vi.spyOn(seedRepo, 'clearLearnerData').mockResolvedValue(undefined);
    vi.spyOn(seedRepo, 'runSeed').mockResolvedValue({
      rolesCount: 1,
      skillsCount: 11,
      roleSkillsCount: 11,
      prerequisitesCount: 8,
      resourcesCount: 22,
    });

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Demo reset completed successfully');
  });

  it('should allow demo reset outside production without explicit DEMO_MODE', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.DEMO_MODE;

    vi.spyOn(seedRepo, 'clearLearnerData').mockResolvedValue(undefined);
    vi.spyOn(seedRepo, 'runSeed').mockResolvedValue({
      rolesCount: 1,
      skillsCount: 11,
      roleSkillsCount: 11,
      prerequisitesCount: 8,
      resourcesCount: 22,
    });

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
