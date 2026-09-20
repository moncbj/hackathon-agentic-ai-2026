// tests/services/assessment.test.ts
// Unit and integration tests for Assessment Service (SPEC-004)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateAssessment,
  getAssessment,
  submitAssessment,
} from '@/services/assessment';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as assessmentsRepo from '@/lib/db/repositories/assessments';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as assessmentRunner from '@/agents/assessment/run';

describe('services/assessment', () => {
  const mockLearnerId = 'learner-123';
  const mockSkillId = 'skill-spreadsheets';

  const mockLearner: learnersRepo.LearnerRecord = {
    id: mockLearnerId,
    name: 'Ana García',
    target_role_id: 'role-data-analyst',
    background: 'Estudiante',
    weekly_hours: 5,
    extra_skills: [],
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockSkill = {
    id: mockSkillId,
    slug: 'spreadsheets',
    name: 'Spreadsheets',
    description: 'Análisis cuantitativo con hojas de cálculo',
    category: 'Analysis',
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockRoleSkills = [
    {
      ...mockSkill,
      required_level: 3,
      weight: 4,
    },
  ];

  const mockLearnerSkill: learnerSkillsRepo.LearnerSkillRecord = {
    learner_id: mockLearnerId,
    skill_id: mockSkillId,
    level: 3,
    verification: 'self_reported',
    status: 'acquired',
    progress: 0,
    consecutive_failures: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const sample5Questions: assessmentsRepo.AssessmentRecord['questions'] = [
    {
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Q1 MCQ',
      options: [
        { id: '1a', text: 'A' },
        { id: '1b', text: 'B' },
        { id: '1c', text: 'C' },
        { id: '1d', text: 'D' },
      ],
      correctOptionId: '1b',
      explanation: 'Secret Explanation 1',
    },
    {
      id: 'q2',
      type: 'multiple_choice',
      prompt: 'Q2 MCQ',
      options: [
        { id: '2a', text: 'A' },
        { id: '2b', text: 'B' },
        { id: '2c', text: 'C' },
        { id: '2d', text: 'D' },
      ],
      correctOptionId: '2c',
      explanation: 'Secret Explanation 2',
    },
    {
      id: 'q3',
      type: 'multiple_choice',
      prompt: 'Q3 MCQ',
      options: [
        { id: '3a', text: 'A' },
        { id: '3b', text: 'B' },
        { id: '3c', text: 'C' },
        { id: '3d', text: 'D' },
      ],
      correctOptionId: '3a',
      explanation: 'Secret Explanation 3',
    },
    {
      id: 'q4',
      type: 'short_answer',
      prompt: 'Q4 Short Answer',
      rubric: {
        criteria: [{ description: 'Crit 1', points: 2.0 }],
        maxPoints: 2.0,
      },
      explanation: 'Secret Explanation 4',
    },
    {
      id: 'q5',
      type: 'short_answer',
      prompt: 'Q5 Short Answer',
      rubric: {
        criteria: [{ description: 'Crit 2', points: 2.0 }],
        maxPoints: 2.0,
      },
      explanation: 'Secret Explanation 5',
    },
  ];

  const mockGeneratedAssessment: assessmentsRepo.AssessmentRecord = {
    id: 'assessment-001',
    learner_id: mockLearnerId,
    skill_id: mockSkillId,
    kind: 'verification',
    target_level: 3,
    questions: sample5Questions,
    answers: {},
    score: null,
    measured_level: null,
    passed: null,
    feedback: null,
    status: 'generated',
    created_at: '2026-01-01T00:00:00Z',
    graded_at: null,
    skill: {
      id: mockSkillId,
      slug: 'spreadsheets',
      name: 'Spreadsheets',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
    vi.spyOn(learnersRepo, 'getLearnerById').mockResolvedValue(mockLearner);
    vi.spyOn(skillsRepo, 'getSkillBySlug').mockResolvedValue(mockSkill);
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkill').mockResolvedValue(mockLearnerSkill);
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([mockLearnerSkill]);
    vi.spyOn(prereqsRepo, 'getPrerequisitesByRole').mockResolvedValue([]);
    vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(null);
    vi.spyOn(assessmentsRepo, 'getGeneratedAssessmentForSkill').mockResolvedValue(null);
    vi.spyOn(assessmentsRepo, 'getPastPromptsForSkill').mockResolvedValue([]);
  });

  it('generates an assessment and strips sensitive secrets for the client', async () => {
    vi.spyOn(assessmentRunner, 'runAssessmentGenerate').mockResolvedValue({
      questions: sample5Questions,
    });
    vi.spyOn(assessmentsRepo, 'createAssessment').mockResolvedValue(mockGeneratedAssessment);

    const result = await generateAssessment('spreadsheets');

    expect(result.assessment.id).toBe('assessment-001');
    expect(result.questions).toHaveLength(5);
    // Verified: No secrets sent to client
    for (const q of result.questions) {
      expect((q as unknown as Record<string, unknown>).correctOptionId).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).rubric).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).explanation).toBeUndefined();
    }
  });

  it('reuses an existing generated assessment without calling Assessment Agent runner', async () => {
    vi.spyOn(assessmentsRepo, 'getGeneratedAssessmentForSkill').mockResolvedValue(mockGeneratedAssessment);
    const runnerSpy = vi.spyOn(assessmentRunner, 'runAssessmentGenerate');

    const result = await generateAssessment('spreadsheets');

    expect(result.assessment.id).toBe('assessment-001');
    expect(runnerSpy).not.toHaveBeenCalled();
  });

  it('rejects assessment generation with 409 when skill is ineligible', async () => {
    // Ineligible: level 0 and progress < 100
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkill').mockResolvedValue({
      ...mockLearnerSkill,
      level: 0,
      verification: 'self_reported',
      progress: 50,
    });

    await expect(generateAssessment('spreadsheets')).rejects.toThrowError(
      expect.objectContaining({ status: 409, code: 'INELIGIBLE' })
    );
  });

  it('strips secrets in getAssessment when status is generated', async () => {
    vi.spyOn(assessmentsRepo, 'getAssessmentById').mockResolvedValue(mockGeneratedAssessment);

    const result = await getAssessment('assessment-001');

    expect(result.sanitized).toBe(true);
    for (const q of result.assessment.questions) {
      expect(q.correctOptionId).toBeUndefined();
      expect(q.rubric).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  it('reveals answers and explanations in getAssessment when status is graded', async () => {
    vi.spyOn(assessmentsRepo, 'getAssessmentById').mockResolvedValue({
      ...mockGeneratedAssessment,
      status: 'graded',
      score: 0.8,
    });

    const result = await getAssessment('assessment-001');

    expect(result.sanitized).toBe(false);
    expect(result.assessment.questions[0].correctOptionId).toBe('1b');
    expect(result.assessment.questions[0].explanation).toBe('Secret Explanation 1');
  });

  it('CRITICAL INVARIANT: leaves learner state unchanged when short-answer grading fails (502)', async () => {
    vi.spyOn(assessmentsRepo, 'getAssessmentById').mockResolvedValue(mockGeneratedAssessment);
    vi.spyOn(assessmentRunner, 'runAssessmentGrade').mockRejectedValue(
      new Error('Gemini API timeout')
    );

    const updateSkillSpy = vi.spyOn(learnerSkillsRepo, 'updateLearnerSkillFull');
    const gradeAssessmentSpy = vi.spyOn(assessmentsRepo, 'gradeAssessment');

    await expect(
      submitAssessment('assessment-001', {
        q1: '1b',
        q2: '2c',
        q3: '3a',
        q4: 'some answer',
        q5: 'some answer',
      })
    ).rejects.toThrowError(
      expect.objectContaining({ status: 502, code: 'GRADING_FAILED' })
    );

    // Invariant: Zero DB mutations occurred
    expect(updateSkillSpy).not.toHaveBeenCalled();
    expect(gradeAssessmentSpy).not.toHaveBeenCalled();
  });

  it('successfully submits and grades, dropping measured level on incorrect answers and recommending replan', async () => {
    vi.spyOn(assessmentsRepo, 'getAssessmentById').mockResolvedValue(mockGeneratedAssessment);
    vi.spyOn(assessmentRunner, 'runAssessmentGrade').mockResolvedValue({
      items: [
        { questionId: 'q4', score: 0.5, feedback: 'Partial credit' },
        { questionId: 'q5', score: 0.5, feedback: 'Partial credit' },
      ],
      overallFeedback: 'Review needed',
      strugglesWith: ['XLOOKUP', 'SUMIFS'],
    });

    const updateSkillSpy = vi.spyOn(learnerSkillsRepo, 'updateLearnerSkillFull').mockResolvedValue({
      ...mockLearnerSkill,
      level: 2,
      verification: 'verified',
    });
    const gradeAssessmentSpy = vi.spyOn(assessmentsRepo, 'gradeAssessment').mockResolvedValue({
      ...mockGeneratedAssessment,
      status: 'graded',
      score: 0.4,
    });

    // Answers: 1 correct MCQ (q1: 1b), 2 incorrect (q2: wrong, q3: wrong)
    // MCQ points = 1.0, Short answer points = 0.5 + 0.5 = 1.0
    // Total = (1.0 + 1.0) / 5 = 2.0 / 5 = 0.4
    // Measured level = 3 - 1 = 2
    const result = await submitAssessment('assessment-001', {
      q1: '1b', // 1
      q2: '2wrong', // 0
      q3: '3wrong', // 0
      q4: 'student short answer 1',
      q5: 'student short answer 2',
    });

    expect(result.score).toBe(0.4);
    expect(result.measuredLevel).toBe(2);
    expect(result.passed).toBe(false);
    expect(result.newLevel).toBe(2);
    expect(result.verification).toBe('verified');
    expect(result.status).toBe('available');
    expect(result.replanRecommended).toBe(true);

    // DB updates were persisted
    expect(updateSkillSpy).toHaveBeenCalledWith(
      mockLearnerId,
      mockSkillId,
      expect.objectContaining({
        level: 2,
        verification: 'verified',
        status: 'available',
        consecutiveFailures: 1,
      })
    );
    expect(gradeAssessmentSpy).toHaveBeenCalled();
  });
});
