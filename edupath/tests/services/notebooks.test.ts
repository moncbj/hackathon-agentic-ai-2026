// tests/services/notebooks.test.ts
// Service tests for Notebooks CRUD and constraints (SPEC-005 §3.3, §4.11)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createNotebook,
  listNotebooks,
  updateNotebook,
  deleteNotebook,
  NotebookServiceError,
} from '@/services/notebooks';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as notebooksRepo from '@/lib/db/repositories/notebooks';

describe('services/notebooks', () => {
  const mockLearner = {
    id: 'learner-123',
    name: 'Ana García',
    target_role_id: 'role-456',
    background: 'Math',
    weekly_hours: 10,
    extra_skills: [],
    created_at: '2026-01-01',
  };

  const mockCatalogSkills = [
    {
      id: 'skill-sql',
      slug: 'sql',
      name: 'SQL',
      description: 'SQL queries',
      category: 'databases',
      created_at: '2026-01-01',
    },
    {
      id: 'skill-python',
      slug: 'python',
      name: 'Python',
      description: 'Python scripts',
      category: 'programming',
      created_at: '2026-01-01',
    },
  ];

  const mockNotebook: notebooksRepo.NotebookRecord = {
    id: 'nb-1',
    learner_id: 'learner-123',
    title: 'SQL Patterns',
    content: 'SELECT * FROM table;',
    created_at: '2026-01-01T10:00:00Z',
    skills: [
      {
        id: 'skill-sql',
        slug: 'sql',
        name: 'SQL',
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
    vi.spyOn(skillsRepo, 'getSkills').mockResolvedValue(mockCatalogSkills);
    vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([
      {
        learner_id: 'learner-123',
        skill_id: 'skill-sql',
        level: 2,
        verification: 'self_reported',
        status: 'in_progress',
        progress: 50,
        consecutive_failures: 0,
        updated_at: '2026-01-01',
        created_at: '2026-01-01',
      },
    ]);

    vi.spyOn(notebooksRepo, 'createNotebook').mockResolvedValue(mockNotebook);
    vi.spyOn(notebooksRepo, 'getNotebooksByLearner').mockResolvedValue([mockNotebook]);
    vi.spyOn(notebooksRepo, 'getNotebookById').mockImplementation(async (id, learnerId) => {
      if (id === 'nb-1' && (!learnerId || learnerId === 'learner-123')) {
        return mockNotebook;
      }
      return null;
    });
    vi.spyOn(notebooksRepo, 'updateNotebook').mockResolvedValue({
      ...mockNotebook,
      title: 'Updated Title',
    });
    vi.spyOn(notebooksRepo, 'deleteNotebook').mockResolvedValue(true);
  });

  it('rejects creation when title is empty', async () => {
    await expect(
      createNotebook({ title: '', content: 'Notes', skillIds: ['skill-sql'] })
    ).rejects.toThrow(NotebookServiceError);
  });

  it('rejects creation when title exceeds 80 characters', async () => {
    await expect(
      createNotebook({ title: 'T'.repeat(81), content: 'Notes', skillIds: ['skill-sql'] })
    ).rejects.toThrow('Notebook title must not exceed 80 characters');
  });

  it('rejects creation when content exceeds 20,000 characters', async () => {
    await expect(
      createNotebook({ title: 'Valid', content: 'C'.repeat(20001), skillIds: ['skill-sql'] })
    ).rejects.toThrow('Notebook content must not exceed 20,000 characters');
  });

  it('rejects creation without at least one skill association', async () => {
    await expect(
      createNotebook({ title: 'Valid', content: 'Notes', skillIds: [] })
    ).rejects.toThrow('Notebook must be associated with at least one skill');
  });

  it('rejects creation when skillId does not exist in catalog', async () => {
    await expect(
      createNotebook({ title: 'Valid', content: 'Notes', skillIds: ['nonexistent-skill-id'] })
    ).rejects.toThrow('does not exist in the catalog');
  });

  it('creates notebook and enriches skills with learner level and status', async () => {
    const created = await createNotebook({
      title: 'SQL Patterns',
      content: 'SELECT * FROM table;',
      skillIds: ['skill-sql'],
    });

    expect(created.id).toBe('nb-1');
    expect(created.skills[0].level).toBe(2);
    expect(created.skills[0].status).toBe('in_progress');
    expect(notebooksRepo.createNotebook).toHaveBeenCalled();
  });

  it('lists notebooks with enriched skills', async () => {
    const list = await listNotebooks();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('SQL Patterns');
    expect(list[0].skills[0].level).toBe(2);
  });

  it('updates notebook title and validates constraints', async () => {
    const updated = await updateNotebook('nb-1', {
      title: 'Updated Title',
    });

    expect(updated.title).toBe('Updated Title');
    expect(notebooksRepo.updateNotebook).toHaveBeenCalledWith('nb-1', 'learner-123', {
      title: 'Updated Title',
    });
  });

  it('deletes notebook successfully', async () => {
    const result = await deleteNotebook('nb-1');
    expect(result).toEqual({ success: true });
    expect(notebooksRepo.deleteNotebook).toHaveBeenCalledWith('nb-1', 'learner-123');
  });

  it('throws 404 when attempting to delete non-existent notebook', async () => {
    vi.spyOn(notebooksRepo, 'deleteNotebook').mockResolvedValue(false);
    await expect(deleteNotebook('unknown-id')).rejects.toThrow('not found');
  });
});
