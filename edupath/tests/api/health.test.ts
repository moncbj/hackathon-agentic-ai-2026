import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import * as rolesRepo from '@/lib/db/repositories/roles';

describe('API: GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return fixtures ai status when AI_MODE=fixtures', async () => {
    process.env.AI_MODE = 'fixtures';

    // Mock countSeededRoles to simulate healthy database
    vi.spyOn(rolesRepo, 'countSeededRoles').mockResolvedValue(1);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      db: 'ok',
      ai: 'fixtures',
      seededRoles: 1,
    });
  });

  it('should return db: error when database connection fails', async () => {
    process.env.AI_MODE = 'fixtures';

    // Simulate DB connection failure
    vi.spyOn(rolesRepo, 'countSeededRoles').mockRejectedValue(new Error('Connection timeout'));

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      db: 'error',
      ai: 'fixtures',
      seededRoles: 0,
    });
  });

  it('should conform to expected health check shape', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toHaveProperty('db');
    expect(['ok', 'error']).toContain(body.db);

    expect(body).toHaveProperty('ai');
    expect(['ok', 'fixtures', 'error']).toContain(body.ai);

    expect(body).toHaveProperty('seededRoles');
    expect(typeof body.seededRoles).toBe('number');
  });
});
