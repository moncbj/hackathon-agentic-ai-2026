// tests/services/tutor.test.ts
// Service tests for handleTutorChat and suggestedAction sanitization (SPEC-005 §3.1, §4.4)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTutorChat, TutorServiceError } from '@/services/tutor';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as journeysRepo from '@/lib/db/repositories/journeys';
import * as activitiesRepo from '@/lib/db/repositories/activities';
import * as notebooksRepo from '@/lib/db/repositories/notebooks';
import * as tutorAgent from '@/agents/tutor/run';

describe('services/tutor > handleTutorChat', () => {
  const mockLearner = {
    id: 'learner-123',
    name: 'Ana García',
    target_role_id: 'role-456',
    background: 'Math student',
    weekly_hours: 10,
    extra_skills: [],
    created_at: '2026-01-01',
  };

  const mockRole = {
    id: 'role-456',
    slug: 'data-analyst',
    name: 'Data Analyst',
    description: 'Analytics',
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
    {
      id: 'skill-python',
      slug: 'python',
      name: 'Python',
      description: 'Python code',
      category: 'programming',
      created_at: '2026-01-01',
      required_level: 2,
      weight: 3,
    },
  ];

  const mockLearnerSkills = [
    {
      learner_id: 'learner-123',
      skill_id: 'skill-sql',
      level: 1,
      verification: 'self_reported' as const,
      status: 'in_progress' as const,
      progress: 50, // Not eligible for assessment! (progress < 100 and level < requiredLevel with verification=self_reported level=1... wait: level 1 self_reported is verification-eligible for level 1, but let's test level 0!)
      consecutive_failures: 0,
      updated_at: '2026-01-01',
      created_at: '2026-01-01',
    },
    {
      learner_id: 'learner-123',
      skill_id: 'skill-python',
      level: 0,
      verification: 'self_reported' as const,
      status: 'available' as const,
      progress: 0, // Ineligible for assessment (level 0 self_reported, progress 0)
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
    vi.spyOn(journeysRepo, 'getActiveJourney').mockResolvedValue(null);
    vi.spyOn(activitiesRepo, 'getActivitiesWithDetailsByJourney').mockResolvedValue([]);
    vi.spyOn(skillsRepo, 'getSkillBySlug').mockImplementation(async (slug) => {
      const match = mockRoleSkills.find((s) => s.slug === slug);
      return match ?? null;
    });
    vi.spyOn(notebooksRepo, 'getNotebookById').mockResolvedValue(null);
    vi.spyOn(notebooksRepo, 'getNotebooksBySkill').mockResolvedValue([]);

    vi.spyOn(tutorAgent, 'runTutorChat').mockResolvedValue({
      answer: 'Great question! Here is how to approach your study.',
      followUps: ['Next step?'],
      suggestedAction: {
        type: 'open_journey',
      },
    });
  });

  it('rejects empty or missing question with 400 error', async () => {
    await expect(handleTutorChat({ question: '' })).rejects.toThrow(TutorServiceError);
    await expect(handleTutorChat({ question: '   ' })).rejects.toThrow(TutorServiceError);
  });

  it('rejects question exceeding 1000 characters', async () => {
    await expect(handleTutorChat({ question: 'A'.repeat(1001) })).rejects.toThrow(TutorServiceError);
  });

  it('fails if no active learner exists', async () => {
    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);
    await expect(handleTutorChat({ question: 'Hello' })).rejects.toThrow('No active learner profile found');
  });

  it('executes chat and retains valid open_journey action', async () => {
    const result = await handleTutorChat({ question: 'How is my progress?' });

    expect(result.answer).toContain('Great question');
    expect(result.suggestedAction).toEqual({ type: 'open_journey' });
  });

  it('sanitizes and strips start_assessment when skill is not eligible for assessment', async () => {
    // Agent erroneously suggests start_assessment on Python (level 0, progress 0 -> ineligible!)
    vi.spyOn(tutorAgent, 'runTutorChat').mockResolvedValue({
      answer: 'You should assess Python now.',
      followUps: [],
      suggestedAction: {
        type: 'start_assessment',
        skillSlug: 'python',
      },
    });

    const result = await handleTutorChat({ question: 'Can I test Python?' });

    // Answer is preserved, but ineligible suggestedAction is stripped!
    expect(result.answer).toBe('You should assess Python now.');
    expect(result.suggestedAction).toBeUndefined();
  });

  it('sanitizes and strips suggestedAction when skillSlug does not exist in catalog', async () => {
    vi.spyOn(tutorAgent, 'runTutorChat').mockResolvedValue({
      answer: 'Try this skill.',
      followUps: [],
      suggestedAction: {
        type: 'open_skill',
        skillSlug: 'nonexistent-skill',
      },
    });

    const result = await handleTutorChat({ question: 'What skill next?' });

    expect(result.answer).toBe('Try this skill.');
    expect(result.suggestedAction).toBeUndefined();
  });

  it('sanitizes and strips open_notebook when notebook does not belong to active learner', async () => {
    vi.spyOn(tutorAgent, 'runTutorChat').mockResolvedValue({
      answer: 'Check your notes.',
      followUps: [],
      suggestedAction: {
        type: 'open_notebook',
        notebookId: 'someone-elses-notebook',
      },
    });

    // getNotebookById returns null because learnerId does not own it
    vi.spyOn(notebooksRepo, 'getNotebookById').mockResolvedValue(null);

    const result = await handleTutorChat({ question: 'Show my notes.' });

    expect(result.answer).toBe('Check your notes.');
    expect(result.suggestedAction).toBeUndefined();
  });

  it('selects explicit notebooks and truncates content to 4000 characters', async () => {
    const mockNotebook = {
      id: 'nb-1',
      learner_id: 'learner-123',
      title: 'SQL Deep Dive',
      content: 'SELECT '.repeat(1000), // > 4000 chars
      created_at: '2026-01-01',
      skills: [],
    };

    vi.spyOn(notebooksRepo, 'getNotebookById').mockResolvedValue(mockNotebook);

    await handleTutorChat({
      question: 'Explain this query',
      notebookIds: ['nb-1'],
    });

    expect(tutorAgent.runTutorChat).toHaveBeenCalledWith(
      expect.objectContaining({
        notebooks: [
          expect.objectContaining({
            title: 'SQL Deep Dive',
            content: expect.any(String),
          }),
        ],
      })
    );

    const callArg = vi.mocked(tutorAgent.runTutorChat).mock.calls[0][0];
    expect(callArg.notebooks![0].content.length).toBeLessThanOrEqual(4000);
  });
});
