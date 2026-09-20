import { getDbClient } from '../client';
import { Tone, DetailLevel } from '@/domain/constants';

export interface TutorStyleRecord {
  learner_id: string;
  language: string;
  tone: Tone;
  detail_level: DetailLevel;
  use_analogies: boolean;
  free_instructions: string;
  created_at: string;
}

export interface TutorStyleInsert {
  learnerId: string;
  language?: string;
  tone: Tone;
  detailLevel: DetailLevel;
  useAnalogies: boolean;
  freeInstructions?: string;
}

export async function createTutorStyle(input: TutorStyleInsert): Promise<TutorStyleRecord> {
  const db = getDbClient();
  const { data, error } = await db
    .from('tutor_styles')
    .insert({
      learner_id: input.learnerId,
      language: input.language ?? 'es',
      tone: input.tone,
      detail_level: input.detailLevel,
      use_analogies: input.useAnalogies,
      free_instructions: input.freeInstructions ?? '',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create tutor style: ${error.message}`);
  }

  return data;
}

export async function getTutorStyle(learnerId: string): Promise<TutorStyleRecord | null> {
  const db = getDbClient();
  const { data, error } = await db
    .from('tutor_styles')
    .select('*')
    .eq('learner_id', learnerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch tutor style for learner "${learnerId}": ${error.message}`);
  }

  return data;
}
