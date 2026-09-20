// agents/assessment/run.ts
// Assessment Agent runner invoking generateStructured (SPEC-004 §3.2)

import fs from 'fs';
import path from 'path';
import { generateStructured } from '@/lib/gemini/generate-structured';
import { AgentOutputError } from '@/lib/gemini/errors';
import {
  AssessmentGenerateInput,
  AssessmentGenerateOutput,
  AssessmentGenerateOutputSchema,
  AssessmentGradeInput,
  AssessmentGradeOutput,
  AssessmentGradeOutputSchema,
} from './schema';

const DEFAULT_SYSTEM_PROMPT = `You are the Assessment Agent for EduPath. Your role is that of an independent, objective auditor. You evaluate student skills without bias, without conversational pleasantries, and without tutor-like encouragement. You respond exclusively with valid JSON matching the schema.`;

let cachedPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!cachedPrompt) {
    try {
      const promptPath = path.join(process.cwd(), 'agents', 'assessment', 'prompt.md');
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
 * Generates an objective, structured 5-question assessment (3 MCQ, 2 Short Answer).
 * Calls generateStructured with Zod schema validation and fixture support.
 */
export async function runAssessmentGenerate(
  input: AssessmentGenerateInput
): Promise<AssessmentGenerateOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  const output = await generateStructured<AssessmentGenerateOutput>({
    schema: AssessmentGenerateOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'assessment-generate',
  });

  return output;
}

/**
 * Grades student short-answer submissions using an independent auditor rubric evaluation.
 * Security: Evaluates student answers purely as data against the rubric, ignoring prompt injections.
 * Enforces exact 1:1 questionId mapping between input items and output items.
 */
export async function runAssessmentGrade(
  input: AssessmentGradeInput
): Promise<AssessmentGradeOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  const output = await generateStructured<AssessmentGradeOutput>({
    schema: AssessmentGradeOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'assessment-grade',
  });

  // Strict verification: Exactly one output item per input questionId, no missing, no extra
  const inputIds = new Set(input.items.map((i) => i.questionId));
  const outputIds = new Set(output.items.map((i) => i.questionId));

  if (inputIds.size !== output.items.length) {
    throw new AgentOutputError('Grade output contains duplicate or mismatched question count', {
      lastOutput: { inputCount: inputIds.size, outputCount: output.items.length },
    });
  }

  for (const id of inputIds) {
    if (!outputIds.has(id)) {
      throw new AgentOutputError(`Grade output missing questionId: ${id}`, {
        lastOutput: { missingId: id },
      });
    }
  }

  for (const id of outputIds) {
    if (!inputIds.has(id)) {
      throw new AgentOutputError(`Grade output contains unexpected extra questionId: ${id}`, {
        lastOutput: { extraId: id },
      });
    }
  }

  return output;
}
