// lib/db/repositories/notebooks.ts
// Database repository for notebooks and notebook_skills tables (SPEC-005 §3.3, §3.4)

import { getDbClient } from '../client';

export interface NotebookSkillInfo {
  id: string;
  slug: string;
  name: string;
  description?: string;
  level?: number;
  status?: string;
}

export interface NotebookRecord {
  id: string;
  learner_id: string;
  title: string;
  content: string;
  created_at: string;
  skills: NotebookSkillInfo[];
}

export interface CreateNotebookInput {
  learnerId: string;
  title: string;
  content: string;
  skillIds: string[];
}

export interface UpdateNotebookInput {
  title?: string;
  content?: string;
  skillIds?: string[];
}

interface RawNotebookRow {
  id: string;
  learner_id: string;
  title: string;
  content: string;
  created_at: string;
  notebook_skills?: Array<{
    skill_id: string;
    skill?: {
      id: string;
      slug: string;
      name: string;
      description?: string;
    } | null;
  }>;
}

function mapNotebookRow(row: RawNotebookRow): NotebookRecord {
  const skills: NotebookSkillInfo[] = [];
  if (Array.isArray(row.notebook_skills)) {
    for (const ns of row.notebook_skills) {
      if (ns.skill) {
        skills.push({
          id: ns.skill.id,
          slug: ns.skill.slug,
          name: ns.skill.name,
          description: ns.skill.description,
        });
      }
    }
  }

  return {
    id: row.id,
    learner_id: row.learner_id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
    skills,
  };
}

/**
 * Creates a new notebook with associated skill IDs.
 */
export async function createNotebook(input: CreateNotebookInput): Promise<NotebookRecord> {
  const db = getDbClient();

  // 1. Insert notebook
  const { data: notebook, error: nbError } = await db
    .from('notebooks')
    .insert({
      learner_id: input.learnerId,
      title: input.title,
      content: input.content,
    })
    .select('*')
    .single();

  if (nbError || !notebook) {
    throw new Error(`Failed to create notebook: ${nbError?.message}`);
  }

  // 2. Insert skill associations
  if (input.skillIds.length > 0) {
    const associationRows = input.skillIds.map((skillId) => ({
      notebook_id: notebook.id,
      skill_id: skillId,
    }));

    const { error: assocError } = await db
      .from('notebook_skills')
      .insert(associationRows);

    if (assocError) {
      // Cleanup orphaned notebook on failure
      await db.from('notebooks').delete().eq('id', notebook.id);
      throw new Error(`Failed to associate skills with notebook: ${assocError.message}`);
    }
  }

  // 3. Return full record with joined skills
  const created = await getNotebookById(notebook.id, input.learnerId);
  if (!created) {
    throw new Error('Notebook created but failed to fetch complete record');
  }

  return created;
}

/**
 * Retrieves all notebooks for a learner, sorted by newest first.
 */
export async function getNotebooksByLearner(learnerId: string): Promise<NotebookRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('notebooks')
    .select(`
      *,
      notebook_skills (
        skill_id,
        skill:skills (
          id,
          slug,
          name,
          description
        )
      )
    `)
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch notebooks for learner "${learnerId}": ${error.message}`);
  }

  return ((data as unknown as RawNotebookRow[]) ?? []).map(mapNotebookRow);
}

/**
 * Retrieves a single notebook by ID (and optionally checks learner ownership).
 */
export async function getNotebookById(
  id: string,
  learnerId?: string
): Promise<NotebookRecord | null> {
  const db = getDbClient();
  let query = db
    .from('notebooks')
    .select(`
      *,
      notebook_skills (
        skill_id,
        skill:skills (
          id,
          slug,
          name,
          description
        )
      )
    `)
    .eq('id', id);

  if (learnerId) {
    query = query.eq('learner_id', learnerId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch notebook "${id}": ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapNotebookRow(data as unknown as RawNotebookRow);
}

/**
 * Retrieves up to `limit` most recent notebooks associated with a specific skill for a learner.
 */
export async function getNotebooksBySkill(
  learnerId: string,
  skillId: string,
  limit: number = 2
): Promise<NotebookRecord[]> {
  const db = getDbClient();

  // Find notebook IDs associated with this skill
  const { data: associations, error: assocError } = await db
    .from('notebook_skills')
    .select('notebook_id')
    .eq('skill_id', skillId);

  if (assocError) {
    throw new Error(`Failed to find notebooks for skill "${skillId}": ${assocError.message}`);
  }

  if (!associations || associations.length === 0) {
    return [];
  }

  const notebookIds = associations.map((a) => a.notebook_id);

  const { data, error } = await db
    .from('notebooks')
    .select(`
      *,
      notebook_skills (
        skill_id,
        skill:skills (
          id,
          slug,
          name,
          description
        )
      )
    `)
    .eq('learner_id', learnerId)
    .in('id', notebookIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch notebooks for skill: ${error.message}`);
  }

  return ((data as unknown as RawNotebookRow[]) ?? []).map(mapNotebookRow);
}

/**
 * Updates an existing notebook and optionally synchronizes its associated skills.
 */
export async function updateNotebook(
  id: string,
  learnerId: string,
  updates: UpdateNotebookInput
): Promise<NotebookRecord> {
  const db = getDbClient();

  // Verify ownership
  const existing = await getNotebookById(id, learnerId);
  if (!existing) {
    throw new Error(`Notebook "${id}" not found or unauthorized.`);
  }

  // 1. Update title/content if provided
  const updatePayload: Record<string, unknown> = {};
  if (updates.title !== undefined) updatePayload.title = updates.title;
  if (updates.content !== undefined) updatePayload.content = updates.content;

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await db
      .from('notebooks')
      .update(updatePayload)
      .eq('id', id)
      .eq('learner_id', learnerId);

    if (updateError) {
      throw new Error(`Failed to update notebook "${id}": ${updateError.message}`);
    }
  }

  // 2. Synchronize skills if skillIds provided
  if (updates.skillIds !== undefined) {
    // Delete existing associations
    const { error: deleteError } = await db
      .from('notebook_skills')
      .delete()
      .eq('notebook_id', id);

    if (deleteError) {
      throw new Error(`Failed to reset notebook skills: ${deleteError.message}`);
    }

    // Insert new associations
    if (updates.skillIds.length > 0) {
      const rows = updates.skillIds.map((skillId) => ({
        notebook_id: id,
        skill_id: skillId,
      }));

      const { error: insertError } = await db
        .from('notebook_skills')
        .insert(rows);

      if (insertError) {
        throw new Error(`Failed to update notebook skills: ${insertError.message}`);
      }
    }
  }

  // 3. Return updated full record
  const updated = await getNotebookById(id, learnerId);
  if (!updated) {
    throw new Error(`Failed to fetch updated notebook "${id}"`);
  }

  return updated;
}

/**
 * Deletes a notebook (cascades to notebook_skills in DB).
 */
export async function deleteNotebook(id: string, learnerId: string): Promise<boolean> {
  const db = getDbClient();

  // Verify ownership
  const existing = await getNotebookById(id, learnerId);
  if (!existing) {
    return false;
  }

  const { error } = await db
    .from('notebooks')
    .delete()
    .eq('id', id)
    .eq('learner_id', learnerId);

  if (error) {
    throw new Error(`Failed to delete notebook "${id}": ${error.message}`);
  }

  return true;
}
