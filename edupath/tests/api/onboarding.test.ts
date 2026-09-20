import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/onboarding/route';
import * as onboardingService from '@/services/onboarding';

describe('API: POST /api/onboarding', () => {
  const validPayload = {
    name: 'Ana García',
    background: 'Graduada en Matemáticas',
    targetRoleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    weeklyHours: 12,
    declaredLevels: { sql: 2, spreadsheets: 3 },
    extraSkills: [{ name: 'Git', level: 2 }],
    tutorStyle: {
      language: 'es',
      tone: 'cercano',
      detailLevel: 'equilibrado',
      useAnalogies: true,
      freeInstructions: 'Explícamelo con analogías cotidianas',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 201 with created profile on successful onboarding', async () => {
    const mockResult = {
      learner: {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Ana García',
        targetRoleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        background: 'Graduada en Matemáticas',
        weeklyHours: 12,
        extraSkills: [{ name: 'Git', level: 2 }],
        createdAt: '2026-09-19T00:00:00Z',
      },
      tutorStyle: {
        language: 'es',
        tone: 'cercano' as const,
        detailLevel: 'equilibrado' as const,
        useAnalogies: true,
        freeInstructions: 'Explícamelo con analogías cotidianas',
      },
      skillStates: [
        {
          skillId: 'skill-1',
          skillSlug: 'sql',
          skillName: 'SQL',
          level: 2,
          requiredLevel: 3,
          verification: 'self_reported' as const,
          status: 'available' as const,
          progress: 0 as const,
          consecutiveFailures: 0 as const,
        },
      ],
    };

    vi.spyOn(onboardingService, 'createOnboarding').mockResolvedValue(mockResult);

    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.learner.name).toBe('Ana García');
    expect(data.tutorStyle.tone).toBe('cercano');
    expect(data.skillStates).toHaveLength(1);
  });

  it('returns 400 when name is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload, name: '' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 when weeklyHours is 0 (below min 1)', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload, weeklyHours: 0 }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 400 when weeklyHours is 41 (above max 40)', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload, weeklyHours: 41 }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('returns 409 when learner already exists (ConflictError)', async () => {
    vi.spyOn(onboardingService, 'createOnboarding').mockRejectedValue(
      new onboardingService.OnboardingError(
        'A learner already exists. Use POST /api/demo/reset to start over.',
        'LEARNER_EXISTS',
        409
      )
    );

    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.code).toBe('LEARNER_EXISTS');
  });

  it('returns 404 when target role does not exist (NotFoundError)', async () => {
    vi.spyOn(onboardingService, 'createOnboarding').mockRejectedValue(
      new onboardingService.OnboardingError('Role not found', 'ROLE_NOT_FOUND', 404)
    );

    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.code).toBe('ROLE_NOT_FOUND');
  });

  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
