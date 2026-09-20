// services/notebooks.ts
// Service for managing study notebooks and skill associations (SPEC-005 §3.3, §3.4)

import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getSkills } from '@/lib/db/repositories/skills';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import {
  createNotebook as repoCreateNotebook,
  getNotebooksByLearner as repoGetNotebooksByLearner,
  getNotebookById as repoGetNotebookById,
  updateNotebook as repoUpdateNotebook,
  deleteNotebook as repoDeleteNotebook,
  NotebookRecord,
} from '@/lib/db/repositories/notebooks';

export class NotebookServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'NOTEBOOK_ERROR'
  ) {
    super(message);
    this.name = 'NotebookServiceError';
  }
}

export interface CreateNotebookParams {
  title: string;
  content: string;
  skillIds: string[];
}

export interface UpdateNotebookParams {
  title?: string;
  content?: string;
  skillIds?: string[];
}

/**
 * Enriches notebook skills with the learner's current level and status.
 */
function enrichNotebookWithLearnerState(
  notebook: NotebookRecord,
  learnerSkillMap: Map<string, { level: number; status: string }>
): NotebookRecord {
  const enrichedSkills = notebook.skills.map((s) => {
    const ls = learnerSkillMap.get(s.id);
    return {
      ...s,
      level: ls?.level ?? 0,
      status: ls?.status ?? 'available',
    };
  });

  return {
    ...notebook,
    skills: enrichedSkills,
  };
}

/**
 * Lists all notebooks for the active learner.
 */
export async function listNotebooks(): Promise<NotebookRecord[]> {
  const learner = await getActiveLearner();
  if (!learner) {
    throw new NotebookServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  const notebooks = await repoGetNotebooksByLearner(learner.id);
  const learnerSkills = await getLearnerSkills(learner.id);
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, { level: ls.level, status: ls.status }]));

  return notebooks.map((nb) => enrichNotebookWithLearnerState(nb, learnerSkillMap));
}

/**
 * Creates a new notebook associated with at least one catalog skill.
 */
export async function createNotebook(params: CreateNotebookParams): Promise<NotebookRecord> {
  const { title, content, skillIds } = params;

  // Validation
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new NotebookServiceError('Notebook title is required', 400, 'INVALID_TITLE');
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 80) {
    throw new NotebookServiceError('Notebook title must not exceed 80 characters', 400, 'TITLE_TOO_LONG');
  }

  if (typeof content !== 'string') {
    throw new NotebookServiceError('Notebook content must be a string', 400, 'INVALID_CONTENT');
  }

  if (content.length > 20000) {
    throw new NotebookServiceError('Notebook content must not exceed 20,000 characters', 400, 'CONTENT_TOO_LONG');
  }

  if (!Array.isArray(skillIds) || skillIds.length === 0) {
    throw new NotebookServiceError('Notebook must be associated with at least one skill', 400, 'MISSING_SKILLS');
  }

  const learner = await getActiveLearner();
  if (!learner) {
    throw new NotebookServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  // Verify all skillIds exist in catalog
  const catalogSkills = await getSkills();
  const catalogSkillIds = new Set(catalogSkills.map((s) => s.id));

  for (const sId of skillIds) {
    if (!catalogSkillIds.has(sId)) {
      throw new NotebookServiceError(`Skill ID "${sId}" does not exist in the catalog`, 400, 'INVALID_SKILL_ID');
    }
  }

  const record = await repoCreateNotebook({
    learnerId: learner.id,
    title: trimmedTitle,
    content,
    skillIds: Array.from(new Set(skillIds)),
  });

  const learnerSkills = await getLearnerSkills(learner.id);
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, { level: ls.level, status: ls.status }]));

  return enrichNotebookWithLearnerState(record, learnerSkillMap);
}

/**
 * Retrieves a single notebook by ID for the active learner.
 */
export async function getNotebook(id: string): Promise<NotebookRecord> {
  const learner = await getActiveLearner();
  if (!learner) {
    throw new NotebookServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  const notebook = await repoGetNotebookById(id, learner.id);
  if (!notebook) {
    throw new NotebookServiceError(`Notebook "${id}" not found`, 404, 'NOTEBOOK_NOT_FOUND');
  }

  const learnerSkills = await getLearnerSkills(learner.id);
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, { level: ls.level, status: ls.status }]));

  return enrichNotebookWithLearnerState(notebook, learnerSkillMap);
}

/**
 * Updates a notebook's title, content, and/or associated skills.
 */
export async function updateNotebook(
  id: string,
  params: UpdateNotebookParams
): Promise<NotebookRecord> {
  const learner = await getActiveLearner();
  if (!learner) {
    throw new NotebookServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  const existing = await repoGetNotebookById(id, learner.id);
  if (!existing) {
    throw new NotebookServiceError(`Notebook "${id}" not found`, 404, 'NOTEBOOK_NOT_FOUND');
  }

  const updates: UpdateNotebookParams = {};

  if (params.title !== undefined) {
    if (typeof params.title !== 'string' || !params.title.trim()) {
      throw new NotebookServiceError('Notebook title cannot be empty', 400, 'INVALID_TITLE');
    }
    const trimmedTitle = params.title.trim();
    if (trimmedTitle.length > 80) {
      throw new NotebookServiceError('Notebook title must not exceed 80 characters', 400, 'TITLE_TOO_LONG');
    }
    updates.title = trimmedTitle;
  }

  if (params.content !== undefined) {
    if (typeof params.content !== 'string') {
      throw new NotebookServiceError('Notebook content must be a string', 400, 'INVALID_CONTENT');
    }
    if (params.content.length > 20000) {
      throw new NotebookServiceError('Notebook content must not exceed 20,000 characters', 400, 'CONTENT_TOO_LONG');
    }
    updates.content = params.content;
  }

  if (params.skillIds !== undefined) {
    if (!Array.isArray(params.skillIds) || params.skillIds.length === 0) {
      throw new NotebookServiceError('Notebook must be associated with at least one skill', 400, 'MISSING_SKILLS');
    }

    const catalogSkills = await getSkills();
    const catalogSkillIds = new Set(catalogSkills.map((s) => s.id));

    for (const sId of params.skillIds) {
      if (!catalogSkillIds.has(sId)) {
        throw new NotebookServiceError(`Skill ID "${sId}" does not exist in the catalog`, 400, 'INVALID_SKILL_ID');
      }
    }

    updates.skillIds = Array.from(new Set(params.skillIds));
  }

  const updated = await repoUpdateNotebook(id, learner.id, updates);
  const learnerSkills = await getLearnerSkills(learner.id);
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, { level: ls.level, status: ls.status }]));

  return enrichNotebookWithLearnerState(updated, learnerSkillMap);
}

/**
 * Deletes a notebook for the active learner.
 */
export async function deleteNotebook(id: string): Promise<{ success: boolean }> {
  const learner = await getActiveLearner();
  if (!learner) {
    throw new NotebookServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  const success = await repoDeleteNotebook(id, learner.id);
  if (!success) {
    throw new NotebookServiceError(`Notebook "${id}" not found`, 404, 'NOTEBOOK_NOT_FOUND');
  }

  return { success: true };
}
