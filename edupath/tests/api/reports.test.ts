// tests/api/reports.test.ts
// Integration tests for POST /api/reports and GET /api/reports (SPEC-005 §3.4, §5)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/reports/route';
import * as reportsService from '@/services/reports';

describe('API > /api/reports', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockReportRecord: reportsService.ReportRecord = {
    id: 'rep-123',
    learner_id: 'learner-456',
    data: {
      acquired: [],
      inProgress: [],
      struggling: [],
      remainingGaps: [],
      toVerify: [],
      activity: { completedThisWeek: 0, totalThisWeek: 2, completedOverall: 0, skippedOverall: 0 },
      assessments: { totalCount: 0, lastThree: [] },
      journey: { currentVersion: 1, latestChangeSummary: 'Initial' },
      nextStepCandidates: [],
    },
    narrative: {
      headline: 'Progress Report: Data Analyst',
      narrative: 'You have solid foundation.',
      nextSteps: [
        {
          candidateId: 'continue_week',
          text: 'Finish your missions',
        },
      ],
    },
    created_at: '2026-01-01T12:00:00Z',
  };

  it('POST /api/reports creates a report and returns 201', async () => {
    vi.spyOn(reportsService, 'generateProgressReport').mockResolvedValue(mockReportRecord);

    const res = await POST();
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBe('rep-123');
    expect(body.narrative.headline).toBe('Progress Report: Data Analyst');
    expect(body.narrative.nextSteps).toHaveLength(1);
  });

  it('POST /api/reports returns 404 when no learner exists', async () => {
    vi.spyOn(reportsService, 'generateProgressReport').mockRejectedValue(
      new reportsService.ReportServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER')
    );

    const res = await POST();
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NO_LEARNER');
  });

  it('GET /api/reports lists the latest reports with 200', async () => {
    vi.spyOn(reportsService, 'getRecentReports').mockResolvedValue([mockReportRecord]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('rep-123');
  });
});
