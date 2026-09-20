// lib/db/repositories/gap-analyses.ts
// Repository for cached gap analysis agent explanations (SPEC-002)

import { getDbClient } from '../client';
import { GapAnalysisAgentOutput } from '@/agents/gap-analysis/schema';

export interface GapAnalysisCacheRecord {
  id: string;
  learnerId: string;
  inputHash: string;
  result: GapAnalysisAgentOutput;
  createdAt: string;
}

interface GapAnalysisDbRow {
  id: string;
  learner_id: string;
  input_hash: string;
  result: GapAnalysisAgentOutput;
  created_at: string;
}

/**
 * Retrieves the most recent cached gap analysis explanation for a learner and input hash.
 * Returns null if no matching cache entry exists.
 */
export async function getGapAnalysisCache(
  learnerId: string,
  inputHash: string
): Promise<GapAnalysisCacheRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('gap_analyses')
    .select('id, learner_id, input_hash, result, created_at')
    .eq('learner_id', learnerId)
    .eq('input_hash', inputHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch gap analysis cache: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as GapAnalysisDbRow;
  return {
    id: row.id,
    learnerId: row.learner_id,
    inputHash: row.input_hash,
    result: row.result,
    createdAt: row.created_at,
  };
}

/**
 * Saves a new gap analysis agent explanation to the cache.
 */
export async function saveGapAnalysisCache(
  learnerId: string,
  inputHash: string,
  result: GapAnalysisAgentOutput
): Promise<GapAnalysisCacheRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('gap_analyses')
    .insert({
      learner_id: learnerId,
      input_hash: inputHash,
      result,
    })
    .select('id, learner_id, input_hash, result, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to save gap analysis cache: ${error.message}`);
  }

  const row = data as unknown as GapAnalysisDbRow;
  return {
    id: row.id,
    learnerId: row.learner_id,
    inputHash: row.input_hash,
    result: row.result,
    createdAt: row.created_at,
  };
}
