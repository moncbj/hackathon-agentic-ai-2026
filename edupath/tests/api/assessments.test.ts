// tests/api/assessments.test.ts
// Integration tests for assessment and replanning API routes (SPEC-004 §3.5)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as assessmentsPOST } from '@/app/api/assessments/route';
import { GET as assessmentGET } from '@/app/api/assessments/[id]/route';
import { POST as assessmentSubmitPOST } from '@/app/api/assessments/[id]/submit/route';
import { POST as replanPOST } from '@/app/api/journey/replan/route';
import * as assessmentService from '@/services/assessment';
import * as replanService from '@/services/replan';

describe('Assessment and Replanning API endpoints (SPEC-004)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/assessments', () => {
    it('returns 400 if skillSlug is missing from body', async () => {
      const req = new NextRequest('http://localhost/api/assessments', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await assessmentsPOST(req);
      expect(res.status).toBe(400);
    });

    it('returns 409 when skill is ineligible for assessment', async () => {
      vi.spyOn(assessmentService, 'generateAssessment').mockRejectedValue(
        new assessmentService.AssessmentServiceError(
          'Skill is not eligible for assessment',
          'INELIGIBLE',
          409
        )
      );

      const req = new NextRequest('http://localhost/api/assessments', {
        method: 'POST',
        body: JSON.stringify({ skillSlug: 'spreadsheets' }),
      });

      const res = await assessmentsPOST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe('INELIGIBLE');
    });

    it('returns 201 with sanitized questions when eligible', async () => {
      vi.spyOn(assessmentService, 'generateAssessment').mockResolvedValue({
        assessment: {
          id: 'assessment-123',
          kind: 'verification',
          targetLevel: 3,
          skillSlug: 'spreadsheets',
          skillName: 'Spreadsheets',
          status: 'generated',
          createdAt: '2026-01-01T00:00:00Z',
        },
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            prompt: 'Sample MCQ',
            options: [
              { id: '1a', text: 'A' },
              { id: '1b', text: 'B' },
              { id: '1c', text: 'C' },
              { id: '1d', text: 'D' },
            ],
          },
        ],
      });

      const req = new NextRequest('http://localhost/api/assessments', {
        method: 'POST',
        body: JSON.stringify({ skillSlug: 'spreadsheets' }),
      });

      const res = await assessmentsPOST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.assessment.id).toBe('assessment-123');
      expect(json.questions[0].correctOptionId).toBeUndefined();
    });
  });

  describe('GET /api/assessments/:id', () => {
    it('returns 404 when assessment does not exist', async () => {
      vi.spyOn(assessmentService, 'getAssessment').mockRejectedValue(
        new assessmentService.AssessmentServiceError('Assessment not found', 'ASSESSMENT_NOT_FOUND', 404)
      );

      const req = new NextRequest('http://localhost/api/assessments/unknown');
      const res = await assessmentGET(req, { params: Promise.resolve({ id: 'unknown' }) });
      expect(res.status).toBe(404);
    });

    it('returns sanitized assessment when status is generated', async () => {
      vi.spyOn(assessmentService, 'getAssessment').mockResolvedValue({
        assessment: {
          id: 'a-1',
          learner_id: 'l-1',
          skill_id: 's-1',
          kind: 'verification',
          target_level: 3,
          questions: [
            {
              id: 'q1',
              type: 'multiple_choice',
              prompt: 'Prompt',
              options: [{ id: '1a', text: 'A' }],
            },
          ],
          answers: {},
          score: null,
          measured_level: null,
          passed: null,
          feedback: null,
          status: 'generated',
          created_at: '',
          graded_at: null,
        } as never,
        sanitized: true,
      });

      const req = new NextRequest('http://localhost/api/assessments/a-1');
      const res = await assessmentGET(req, { params: Promise.resolve({ id: 'a-1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sanitized).toBe(true);
      expect(json.assessment.questions[0].correctOptionId).toBeUndefined();
    });
  });

  describe('POST /api/assessments/:id/submit', () => {
    it('returns 400 when answers object is missing or invalid', async () => {
      const req = new NextRequest('http://localhost/api/assessments/a-1/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: 'invalid string' }),
      });

      const res = await assessmentSubmitPOST(req, { params: Promise.resolve({ id: 'a-1' }) });
      expect(res.status).toBe(400);
    });

    it('returns 502 when short-answer grading fails (leaving state unchanged)', async () => {
      vi.spyOn(assessmentService, 'submitAssessment').mockRejectedValue(
        new assessmentService.AssessmentServiceError('Assessment grading failed', 'GRADING_FAILED', 502)
      );

      const req = new NextRequest('http://localhost/api/assessments/a-1/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: { q1: '1a' } }),
      });

      const res = await assessmentSubmitPOST(req, { params: Promise.resolve({ id: 'a-1' }) });
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.code).toBe('GRADING_FAILED');
    });

    it('returns 200 with result contract on successful submission', async () => {
      vi.spyOn(assessmentService, 'submitAssessment').mockResolvedValue({
        score: 0.6,
        measuredLevel: 2,
        passed: false,
        newLevel: 2,
        verification: 'verified',
        status: 'available',
        itemFeedback: [{ questionId: 'q4', score: 0.5, feedback: 'OK' }],
        overallFeedback: 'Review key formulas',
        strugglesWith: ['XLOOKUP'],
        replanRecommended: true,
        stateChanges: {
          skillSlug: 'spreadsheets',
          oldLevel: 3,
          newLevel: 2,
          oldStatus: 'acquired',
          newStatus: 'available',
          unlockedSkills: [],
        },
      });

      const req = new NextRequest('http://localhost/api/assessments/a-1/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: { q1: '1a', q4: 'answer text' } }),
      });

      const res = await assessmentSubmitPOST(req, { params: Promise.resolve({ id: 'a-1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.score).toBe(0.6);
      expect(json.replanRecommended).toBe(true);
      expect(json.stateChanges.newLevel).toBe(2);
    });
  });

  describe('POST /api/journey/replan', () => {
    it('returns 400 when reason is missing', async () => {
      const req = new NextRequest('http://localhost/api/journey/replan', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await replanPOST(req);
      expect(res.status).toBe(400);
    });

    it('returns 409 when reason is invalid', async () => {
      const req = new NextRequest('http://localhost/api/journey/replan', {
        method: 'POST',
        body: JSON.stringify({ reason: 'role_change' }),
      });

      const res = await replanPOST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.code).toBe('INVALID_REASON');
    });

    it('returns 200 with new journey, changes, and explanation on success', async () => {
      vi.spyOn(replanService, 'executeReplan').mockResolvedValue({
        journey: {
          id: 'journey-v2',
          learner_id: 'learner-1',
          version: 2,
          is_current: true,
          reason: 'assessment',
          summary: 'Week 1: Reinforcement',
          changes: {},
          created_at: '2026-01-02T00:00:00Z',
        },
        changes: [
          {
            type: 'time_reallocated',
            skillSlug: 'spreadsheets',
            detail: 'Reallocated weekly time for Spreadsheets (+150 min)',
          },
        ],
        changeExplanation: 'Replanificamos tu ruta para reforzar conceptos tras la evaluación.',
      });

      const req = new NextRequest('http://localhost/api/journey/replan', {
        method: 'POST',
        body: JSON.stringify({ reason: 'assessment' }),
      });

      const res = await replanPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.journey.version).toBe(2);
      expect(json.changes).toHaveLength(1);
      expect(json.changeExplanation).toContain('Replanificamos');
    });
  });
});
