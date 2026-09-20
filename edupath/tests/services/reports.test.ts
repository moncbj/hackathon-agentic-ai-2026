// tests/services/reports.test.ts
// Service tests for generateProgressReport and AI fallback handling (SPEC-005 §3.2, §4.9, §4.10)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProgressReport, getRecentReports } from '@/services/reports';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as journeysRepo from '@/lib/db/repositories/journeys';
import * as activitiesRepo from '@/lib/db/repositories/activities';
import * as assessmentsRepo from '@/lib/db/repositories/assessments';
import * as reportsRepo from '@/lib/db/repositories/reports';
import * as tutorAgent from '@/agents/tutor/run';

describe('services/reports', () => {
  const mockLearner = {
    id: 'learner-123',
    name: 'Ana García',
    target_role_id: 'role-456',
    background: 'Math',
    weekly_hours: 10,
    extra_skills: [],
    created_at: '2026-01-01',
  };

  const mockRole = {
    id: 'role-456',
    slug: 'data-analyst',
    name: 'Data Analyst',
    description: 'Analytics role',
    created_at: '2026-01-01',
  };

  const mockRoleSkills = [
    {
      id: 'skill-sql',
      slug: 'sql',
      name: 'SQL',
      description: 'SQL queries',
      category: 'databases',
      created_at: '2026-01-01',
      required_level: 3,
      weight: 5,
    },
  ];

  const mockLearnerSkills = [
    {
      learner_id: 'learner-123',
      skill_id: 'skill-sql',
      level: 1,
      verification: 'self_reported' as const,
      status: 'in_progress' as const,
      progress: 50,
      consecutive_failures: 0,
      updated_at: '2026-01-01',
      created_at: '2026-01-01',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
    vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(null);
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue(mockLearnerSkills);
    vi.spyOn(prereqsRepo, 'getPrerequisitesByRole').mockResolvedValue([]);
    vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(null);
    vi.spyOn(activitiesRepo, 'getActivitiesByJourney').mockResolvedValue([]);
    vi.spyOn(assessmentsRepo, 'getAssessmentsByLearner').mockResolvedValue([]);

    vi.spyOn(reportsRepo, 'createReport').mockImplementation(async (input) => ({
      id: 'report-789',
      learner_id: input.learnerId,
      data: input.data,
      narrative: input.narrative,
      created_at: '2026-01-01T12:00:00Z',
    }));

    vi.spyOn(reportsRepo, 'getLatestReports').mockResolvedValue([
      {
        id: 'report-789',
        learner_id: 'learner-123',
        data: {} as unknown as reportsRepo.ReportRecord['data'],
        narrative: {} as unknown as reportsRepo.ReportRecord['narrative'],
        created_at: '2026-01-01T12:00:00Z',
      },
    ]);
  });

  it('generates progress report with AI narrative when agent succeeds', async () => {
    vi.spyOn(tutorAgent, 'runTutorReport').mockResolvedValue({
      headline: 'Excellent Progress',
      narrative: 'You have done great work so far.',
      nextSteps: [
        {
          candidateId: 'review_plan',
          text: 'Review your next goals carefully.',
        },
      ],
    });

    const report = await generateProgressReport();

    expect(report.id).toBe('report-789');
    expect(report.narrative.headline).toBe('Excellent Progress');
    expect(report.narrative.narrative).toBe('You have done great work so far.');
    expect(report.narrative.nextSteps[0].candidateId).toBe('review_plan');
    expect(reportsRepo.createReport).toHaveBeenCalled();
  });

  it('falls back to deterministic narrative when Tutor Report Agent fails', async () => {
    vi.spyOn(tutorAgent, 'runTutorReport').mockRejectedValue(new Error('Gemini API timeout'));

    const report = await generateProgressReport();

    // Report is NOT failed; saved with deterministic fallback
    expect(report.id).toBe('report-789');
    expect(report.narrative.headline).toContain('Progress Report: Data Analyst');
    expect(report.narrative.narrative).toContain('You have acquired');
    expect(report.narrative.nextSteps.length).toBeGreaterThan(0);
    expect(reportsRepo.createReport).toHaveBeenCalled();
  });

  it('rejects AI narrative and uses fallback when agent returns an unknown candidateId', async () => {
    vi.spyOn(tutorAgent, 'runTutorReport').mockResolvedValue({
      headline: 'Some Headline',
      narrative: 'Some Narrative',
      nextSteps: [
        {
          candidateId: 'invented_nonexistent_candidate_id',
          text: 'This should be rejected.',
        },
      ],
    });

    const report = await generateProgressReport();

    // Unknown candidateId is rejected; deterministic fallback used
    expect(report.narrative.headline).toContain('Progress Report: Data Analyst');
    expect(report.narrative.nextSteps.every((s) => s.candidateId !== 'invented_nonexistent_candidate_id')).toBe(true);
  });

  it('retrieves recent reports via getRecentReports', async () => {
    const reports = await getRecentReports(5);
    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe('report-789');
  });
});
