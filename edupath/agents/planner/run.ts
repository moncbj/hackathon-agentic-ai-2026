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

const DEFAULT_SYSTEM_PROMPT = `Eres el Learning Planner Agent de EduPath. Tu función es redactar el contenido pedagógico de un plan semanal de misiones. La estructura de semanas, minutos, habilidades y slots es determinista y no se puede alterar. Responde exclusivamente con JSON válido.`;

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
