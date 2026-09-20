// agents/tutor/run.ts
// Tutor Agent runner invoking generateStructured for chat and report operations (SPEC-005 §3.1, §3.2)

import fs from 'fs';
import path from 'path';
import { generateStructured } from '@/lib/gemini/generate-structured';
import {
  TutorChatInput,
  TutorChatOutput,
  TutorChatOutputSchema,
  TutorReportInput,
  TutorReportOutput,
  TutorReportOutputSchema,
} from './schema';

const DEFAULT_SYSTEM_PROMPT = `You are the personal learning Tutor for EduPath. You accompany the learner, explain concepts playfully and clearly, respect their tutor style, base your answers on their deterministic snapshot, and never change or promise to change skill levels.`;

let cachedPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!cachedPrompt) {
    try {
      const promptPath = path.join(process.cwd(), 'agents', 'tutor', 'prompt.md');
      if (fs.existsSync(promptPath)) {
        cachedPrompt = fs.readFileSync(promptPath, 'utf-8');
      } else {
        cachedPrompt = DEFAULT_SYSTEM_PROMPT;
      }
    } catch {
      cachedPrompt = DEFAULT_SYSTEM_PROMPT;
    }
  }
  return cachedPrompt;
}

/**
 * Runs the Tutor Agent chat operation.
 * Structured generation with Zod validation and fixture support.
 */
export async function runTutorChat(input: TutorChatInput): Promise<TutorChatOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  const output = await generateStructured<TutorChatOutput>({
    schema: TutorChatOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'tutor-chat',
  });

  return output;
}

/**
 * Runs the Tutor Agent progress report narrative generation.
 * Synthesizes report data and rewrites deterministic next-step candidates into natural language.
 */
export async function runTutorReport(input: TutorReportInput): Promise<TutorReportOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  const output = await generateStructured<TutorReportOutput>({
    schema: TutorReportOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'tutor-report',
  });

  return output;
}
