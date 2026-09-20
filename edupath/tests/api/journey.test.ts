// tests/api/journey.test.ts
// Integration tests for journey and activity endpoints (SPEC-003)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as generateJourneyPOST } from '@/app/api/journey/generate/route';
import { GET as getJourneyGET } from '@/app/api/journey/route';
import { POST as completeActivityPOST } from '@/app/api/activities/[id]/complete/route';
import { POST as skipActivityPOST } from '@/app/api/activities/[id]/skip/route';
import * as journeyService from '@/services/journey';

describe('Journey & Activities API endpoints (SPEC-003)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/journey/generate', () => {
    it('returns 201 Created with the generated journey data on success', async () => {
      const mockJourneyResponse: journeyService.JourneyResponse = {
        journey: {
          id: 'journey-1',
          version: 1,
          isCurrent: true,
          reason: 'initial',
          summary: 'Semana 1: Bases de datos',
          changes: {},
          createdAt: '2026-01-01T00:00:00Z',
        },
        weeks: [
          {
            number: 1,
            headline: 'Bases de datos',
            note: 'Dedicación 300 min',
            totalMinutes: 300,
            activities: [],
          },
        ],
        objectives: [
          {
            id: 'obj-1',
            skillId: 'skill-sql',
            description: 'Dominar SQL',
            criteria: ['Escribir consultas'],
            targetLevel: 2,
            status: 'active',
          },
        ],
        stats: {
          totalActivities: 2,
          completedActivities: 0,
          skippedActivities: 0,
          totalMinutes: 300,
          completedMinutes: 0,
        },
      };

      vi.spyOn(journeyService, 'generateInitialJourney').mockResolvedValue(mockJourneyResponse);

      const res = await generateJourneyPOST();
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.journey.id).toBe('journey-1');
      expect(json.weeks).toHaveLength(1);
    });

    it('returns 409 Conflict if an active journey already exists', async () => {
      vi.spyOn(journeyService, 'generateInitialJourney').mockRejectedValue(
        new journeyService.JourneyServiceError(
          'An active learning journey already exists for this learner',
          'JOURNEY_EXISTS',
          409
        )
      );

      const res = await generateJourneyPOST();
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe('JOURNEY_EXISTS');
    });

    it('returns 404 Not Found if learner has not completed onboarding', async () => {
      vi.spyOn(journeyService, 'generateInitialJourney').mockRejectedValue(
        new journeyService.JourneyServiceError(
          'No active learner profile found. Complete onboarding first.',
          'NO_LEARNER',
          404
        )
      );

      const res = await generateJourneyPOST();
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('NO_LEARNER');
    });
  });

  describe('GET /api/journey', () => {
    it('returns 200 OK with active journey', async () => {
      const mockJourneyResponse: journeyService.JourneyResponse = {
        journey: {
          id: 'journey-active',
          version: 1,
          isCurrent: true,
          reason: 'initial',
          summary: 'Semana 1: Bases de datos',
          changes: {},
          createdAt: '2026-01-01T00:00:00Z',
        },
        weeks: [],
        objectives: [],
        stats: {
          totalActivities: 0,
          completedActivities: 0,
          skippedActivities: 0,
          totalMinutes: 0,
          completedMinutes: 0,
        },
      };

      vi.spyOn(journeyService, 'getActiveJourneyData').mockResolvedValue(mockJourneyResponse);

      const res = await getJourneyGET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.journey.id).toBe('journey-active');
    });

    it('returns 404 when no active journey exists', async () => {
      vi.spyOn(journeyService, 'getActiveJourneyData').mockRejectedValue(
        new journeyService.JourneyServiceError(
          'No active learning journey found',
          'NO_ACTIVE_JOURNEY',
          404
        )
      );

      const res = await getJourneyGET();
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('NO_ACTIVE_JOURNEY');
    });
  });

  describe('POST /api/activities/:id/complete', () => {
    it('returns 200 OK with updated activity and skill progress', async () => {
      vi.spyOn(journeyService, 'completeActivity').mockResolvedValue({
        success: true,
        activity: {
          id: 'act-1',
          status: 'done',
          completedAt: '2026-01-02T00:00:00Z',
        },
        skill: {
          skillId: 'skill-sql',
          level: 1,
          status: 'in_progress',
          progress: 50,
          readyForAssessment: false,
        },
      });

      const req = new Request('http://localhost:3000/api/activities/act-1/complete', {
        method: 'POST',
      });
      const res = await completeActivityPOST(req, {
        params: Promise.resolve({ id: 'act-1' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.activity.status).toBe('done');
      expect(json.skill.progress).toBe(50);
      expect(json.skill.level).toBe(1); // Skill level NOT modified!
    });

    it('returns 404 when activity does not exist', async () => {
      vi.spyOn(journeyService, 'completeActivity').mockRejectedValue(
        new journeyService.JourneyServiceError(
          'Activity "unknown" not found',
          'ACTIVITY_NOT_FOUND',
          404
        )
      );

      const req = new Request('http://localhost:3000/api/activities/unknown/complete', {
        method: 'POST',
      });
      const res = await completeActivityPOST(req, {
        params: Promise.resolve({ id: 'unknown' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('ACTIVITY_NOT_FOUND');
    });

    it('returns 403 when activity does not belong to active journey', async () => {
      vi.spyOn(journeyService, 'completeActivity').mockRejectedValue(
        new journeyService.JourneyServiceError(
          'Activity does not belong to active learner journey',
          'NOT_OWNER',
          403
        )
      );

      const req = new Request('http://localhost:3000/api/activities/act-other/complete', {
        method: 'POST',
      });
      const res = await completeActivityPOST(req, {
        params: Promise.resolve({ id: 'act-other' }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('NOT_OWNER');
    });
  });

  describe('POST /api/activities/:id/skip', () => {
    it('returns 200 OK with updated activity and skippedCount', async () => {
      vi.spyOn(journeyService, 'skipActivity').mockResolvedValue({
        success: true,
        activity: {
          id: 'act-1',
          status: 'skipped',
        },
        skippedCount: 1,
      });

      const req = new Request('http://localhost:3000/api/activities/act-1/skip', {
        method: 'POST',
      });
      const res = await skipActivityPOST(req, {
        params: Promise.resolve({ id: 'act-1' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.activity.status).toBe('skipped');
      expect(json.skippedCount).toBe(1);
    });

    it('returns 404 when activity does not exist', async () => {
      vi.spyOn(journeyService, 'skipActivity').mockRejectedValue(
        new journeyService.JourneyServiceError(
          'Activity "unknown" not found',
          'ACTIVITY_NOT_FOUND',
          404
        )
      );

      const req = new Request('http://localhost:3000/api/activities/unknown/skip', {
        method: 'POST',
      });
      const res = await skipActivityPOST(req, {
        params: Promise.resolve({ id: 'unknown' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('ACTIVITY_NOT_FOUND');
    });
  });
});
