// agents/planner/run.ts
// Learning Planner Agent runner invoking generateStructured (SPEC-003 §3.2)

import fs from 'fs';
import path from 'path';
import { generateStructured } from '@/lib/gemini/generate-structured';
import {
  PlannerAgentInput,
  PlannerAgentOutput,
  PlannerAgentOutputSchema,
} from './schema';

const DEFAULT_SYSTEM_PROMPT = `You are the Learning Planner Agent for EduPath. Your role is to write the pedagogical content for a weekly mission plan in natural English (or the student's selected language). The structure of weeks, minutes, skills, and slots is deterministic and cannot be altered. Respond exclusively with valid JSON.`;

let cachedPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!cachedPrompt) {
    try {
      const promptPath = path.join(process.cwd(), 'agents', 'planner', 'prompt.md');
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
 * Executes the Learning Planner Agent to produce rich narrative, objectives,
 * missions, instructions, and weekly summaries for a deterministic journey skeleton.
 * Uses centralized generateStructured with Zod validation and fixture support.
 */
export async function runPlannerAgent(
  input: PlannerAgentInput
): Promise<PlannerAgentOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  return generateStructured<PlannerAgentOutput>({
    schema: PlannerAgentOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'planner',
  });
}
