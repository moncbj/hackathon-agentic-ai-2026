// tests/api/gaps.test.ts
// Integration tests for GET /api/gaps endpoint (SPEC-002)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/gaps/route';
import * as gapsService from '@/services/gaps';

describe('API: GET /api/gaps', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with full deterministic metrics and agent explanation on happy path', async () => {
    const mockGapsResponse: gapsService.GapsResponse = {
      summary: {
        totalSkills: 2,
        acquired: 1,
        withGap: 1,
        needsVerification: 1,
      },
      gaps: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          level: 1,
          requiredLevel: 3,
          gap: 2,
          priority: 10,
          needsVerification: false,
        },
        {
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
          requiredLevel: 3,
          gap: 0,
          priority: 0,
          needsVerification: true,
        },
      ],
      topPriorities: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          gap: 2,
          priority: 10,
        },
      ],
      unverified: [
        {
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
        },
      ],
      agentExplanation: {
        summary: 'Resumen claro del perfil.',
        perSkill: [
          {
            skillSlug: 'sql',
            explanation: 'Falta SQL para el rol.',
            whyItMatters: 'Esencial para consultas.',
          },
        ],
        recommendedFocus: ['sql'],
      },
    };

    vi.spyOn(gapsService, 'getGapAnalysisAndExplanation').mockResolvedValue(mockGapsResponse);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.summary.totalSkills).toBe(2);
    expect(body.gaps).toHaveLength(2);
    expect(body.topPriorities).toHaveLength(1);
    expect(body.unverified).toHaveLength(1);
    expect(body.agentExplanation?.summary).toBe('Resumen claro del perfil.');
  });

  it('returns 200 with deterministic data and agentExplanation: null when agent fails', async () => {
    const mockFallbackResponse: gapsService.GapsResponse = {
      summary: {
        totalSkills: 2,
        acquired: 1,
        withGap: 1,
        needsVerification: 1,
      },
      gaps: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          level: 1,
          requiredLevel: 3,
          gap: 2,
          priority: 10,
          needsVerification: false,
        },
        {
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
          requiredLevel: 3,
          gap: 0,
          priority: 0,
          needsVerification: true,
        },
      ],
      topPriorities: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          gap: 2,
          priority: 10,
        },
      ],
      unverified: [
        {
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
        },
      ],
      agentExplanation: null, // AI failure fallback
    };

    vi.spyOn(gapsService, 'getGapAnalysisAndExplanation').mockResolvedValue(mockFallbackResponse);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.summary.totalSkills).toBe(2);
    expect(body.gaps).toHaveLength(2);
    expect(body.agentExplanation).toBeNull();
  });

  it('returns 404 when no active learner is found', async () => {
    vi.spyOn(gapsService, 'getGapAnalysisAndExplanation').mockRejectedValue(
      new gapsService.GapsServiceError('No active learner profile found', 'NO_LEARNER', 404)
    );

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.code).toBe('NO_LEARNER');
    expect(body.error).toContain('No active learner');
  });

  it('returns 400 when learner has no target role', async () => {
    vi.spyOn(gapsService, 'getGapAnalysisAndExplanation').mockRejectedValue(
      new gapsService.GapsServiceError('Active learner has no target role specified', 'NO_TARGET_ROLE', 400)
    );

    const response = await GET();
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('NO_TARGET_ROLE');
  });

  it('returns 404 when target role is not found in database', async () => {
    vi.spyOn(gapsService, 'getGapAnalysisAndExplanation').mockRejectedValue(
      new gapsService.GapsServiceError('Target role not found', 'ROLE_NOT_FOUND', 404)
    );

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.code).toBe('ROLE_NOT_FOUND');
  });

  it('returns 500 when unexpected error occurs', async () => {
    vi.spyOn(gapsService, 'getGapAnalysisAndExplanation').mockRejectedValue(
      new Error('Unexpected database failure')
    );

    const response = await GET();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to retrieve gap analysis');
  });
});
