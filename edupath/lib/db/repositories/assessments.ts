// lib/db/repositories/assessments.ts
// Database repository for assessments (SPEC-004 §3.2, §3.5)

import { getDbClient } from '../client';
import { AssessmentQuestionItem } from '@/agents/assessment/schema';
import { AssessmentKind, AssessmentStatus } from '@/domain/constants';

export interface AssessmentRecord {
  id: string;
  learner_id: string;
  skill_id: string;
  kind: AssessmentKind;
  target_level: number;
  questions: AssessmentQuestionItem[];
  answers: unknown;
  score: number | null;
  measured_level: number | null;
  passed: boolean | null;
  feedback: unknown | null;
  status: AssessmentStatus;
  created_at: string;
  graded_at: string | null;
  skill?: {
    id?: string;
    slug?: string;
    name?: string;
    description?: string;
  } | null;
}

export interface CreateAssessmentInput {
  learnerId: string;
  skillId: string;
  kind: AssessmentKind;
  targetLevel: number;
  questions: AssessmentQuestionItem[];
}

export interface GradeAssessmentData {
  answers: Record<string, string>;
  score: number;
  measuredLevel: number;
  passed: boolean;
  feedback: {
    items: Array<{ questionId: string; score: number; feedback?: string }>;
    overallFeedback: string;
    strugglesWith: string[];
  };
}

export interface SubmitAssessmentTransactionInput extends GradeAssessmentData {
  assessmentId: string; learnerId: string; skillId: string;
  skillState: { level: number; verification: string; status: string; progress: number; consecutiveFailures: number };
  statusUpdates: Array<{ skillId: string; status: string }>;
}

/** Executes every persisted effect of assessment submission in one database transaction. */
export async function submitAssessmentTransaction(input: SubmitAssessmentTransactionInput): Promise<void> {
  const { error } = await getDbClient().rpc('submit_assessment_transaction', {
    p_assessment_id: input.assessmentId, p_learner_id: input.learnerId, p_skill_id: input.skillId,
    p_level: input.skillState.level, p_verification: input.skillState.verification, p_status: input.skillState.status,
    p_progress: input.skillState.progress, p_consecutive_failures: input.skillState.consecutiveFailures,
    p_status_updates: input.statusUpdates, p_answers: input.answers, p_score: input.score,
    p_measured_level: input.measuredLevel, p_passed: input.passed, p_feedback: input.feedback,
  });
  if (error) throw new Error(`Failed to submit assessment transaction: ${error.message}`);
}

/**
 * Creates a new assessment in 'generated' status.
 */
export async function createAssessment(
  input: CreateAssessmentInput
): Promise<AssessmentRecord> {
  const db = getDbClient();
  const row = {
    learner_id: input.learnerId,
    skill_id: input.skillId,
    kind: input.kind,
    target_level: input.targetLevel,
    questions: input.questions,
    answers: {},
    status: 'generated',
  };

  const { data, error } = await db
    .from('assessments')
    .insert(row)
    .select(`
      *,
      skill:skills(id, slug, name, description)
    `)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create assessment: ${error?.message}`);
  }

  return data as unknown as AssessmentRecord;
}

/**
 * Retrieves an assessment by ID including skill metadata.
 */
export async function getAssessmentById(id: string): Promise<AssessmentRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('assessments')
    .select(`
      *,
      skill:skills(id, slug, name, description)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch assessment "${id}": ${error.message}`);
  }

  return (data as unknown as AssessmentRecord) ?? null;
}

/**
 * Checks for an existing 'generated' (un-submitted) assessment for this learner and skill.
 * SPEC-004 §3.1: If an existing generated assessment exists, it is reused.
 */
export async function getGeneratedAssessmentForSkill(
  learnerId: string,
  skillId: string
): Promise<AssessmentRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('assessments')
    .select(`
      *,
      skill:skills(id, slug, name, description)
    `)
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .eq('status', 'generated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to check existing generated assessment for learner "${learnerId}", skill "${skillId}": ${error.message}`
    );
  }

  return (data as unknown as AssessmentRecord) ?? null;
}

/**
 * Extracts past prompts asked in prior assessments for this learner and skill
 * to prevent duplicates during question generation.
 */
export async function getPastPromptsForSkill(
  learnerId: string,
  skillId: string
): Promise<string[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('assessments')
    .select('questions')
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId);

  if (error) {
    throw new Error(
      `Failed to fetch past prompts for learner "${learnerId}", skill "${skillId}": ${error.message}`
    );
  }

  const prompts: string[] = [];
  if (data) {
    for (const row of data) {
      if (Array.isArray(row.questions)) {
        for (const q of row.questions) {
          if (q && typeof q.prompt === 'string') {
            prompts.push(q.prompt);
          }
        }
      }
    }
  }

  return prompts;
}

/**
 * Updates an assessment with grading results, score, measured level, and feedback.
 */
export async function gradeAssessment(
  id: string,
  gradeData: GradeAssessmentData
): Promise<AssessmentRecord> {
  const db = getDbClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('assessments')
    .update({
      answers: gradeData.answers,
      score: gradeData.score,
      measured_level: gradeData.measuredLevel,
      passed: gradeData.passed,
      feedback: gradeData.feedback,
      status: 'graded',
      graded_at: now,
    })
    .eq('id', id)
    .select(`
      *,
      skill:skills(id, slug, name, description)
    `)
    .single();

  if (error || !data) {
    throw new Error(`Failed to grade assessment "${id}": ${error?.message}`);
  }

  return data as unknown as AssessmentRecord;
}

/**
 * Retrieves all assessments for a learner.
 */
export async function getAssessmentsByLearner(
  learnerId: string
): Promise<AssessmentRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('assessments')
    .select(`
      *,
      skill:skills(id, slug, name, description)
    `)
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch assessments for learner "${learnerId}": ${error.message}`);
  }

  return (data as unknown as AssessmentRecord[]) ?? [];
}
