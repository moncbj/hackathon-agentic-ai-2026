// lib/db/repositories/reports.ts
// Database repository for reports table (SPEC-005 §3.2, §3.4)

import { getDbClient } from '../client';
import { ProgressReportResult } from '@/domain/report';

export interface ReportNarrative {
  headline: string;
  narrative: string;
  nextSteps: Array<{
    candidateId: string;
    text: string;
  }>;
}

export interface ReportRecord {
  id: string;
  learner_id: string;
  data: ProgressReportResult;
  narrative: ReportNarrative;
  created_at: string;
}

export interface CreateReportInput {
  learnerId: string;
  data: ProgressReportResult;
  narrative: ReportNarrative;
}

/**
 * Persists a new progress report.
 */
export async function createReport(input: CreateReportInput): Promise<ReportRecord> {
  const db = getDbClient();
  const row = {
    learner_id: input.learnerId,
    data: input.data,
    narrative: input.narrative,
  };

  const { data, error } = await db
    .from('reports')
    .insert(row)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to save report: ${error?.message}`);
  }

  return data as unknown as ReportRecord;
}

/**
 * Retrieves the latest reports for a learner, sorted newest first.
 */
export async function getLatestReports(
  learnerId: string,
  limit: number = 5
): Promise<ReportRecord[]> {
  const db = getDbClient();
  const { data, error } = await db
    .from('reports')
    .select('*')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch reports for learner "${learnerId}": ${error.message}`);
  }

  return (data as unknown as ReportRecord[]) ?? [];
}

/**
 * Retrieves a single report by ID.
 */
export async function getReportById(id: string): Promise<ReportRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch report by ID "${id}": ${error.message}`);
  }

  return (data as unknown as ReportRecord) ?? null;
}
