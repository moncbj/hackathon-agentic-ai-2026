// agents/gap-analysis/run.ts
// Gap Analysis Agent runner invoking generateStructured with schema and prompt (SPEC-002)

import fs from 'fs';
import path from 'path';
import { generateStructured } from '@/lib/gemini/generate-structured';
import {
  GapAnalysisAgentInput,
  GapAnalysisAgentOutput,
  GapAnalysisAgentOutputSchema,
} from './schema';

const DEFAULT_SYSTEM_PROMPT = `You are the Gap Analysis Agent for EduPath. Your role is to explain and contextualize skill gaps in accessible, encouraging language for a student targeting their desired role.

### Strict rules:
1. Explain the gaps and skills suggested for verification in clear, natural English (or the student's selected tutorStyle language).
2. Numerical values (levels, gaps, priorities) are definitive and deterministic; never attempt to recalculate them.
3. Do not invent skills or use slugs that do not exist in the input.
4. In recommendedFocus and perSkill, use only the skillSlug values provided in the input.
5. Adapt your wording to the supplied tutorStyle.

### Output constraints:
- summary: 2 to 4 sentences (maximum 500 characters).
- perSkill: array of { skillSlug, explanation (max 250 characters), whyItMatters (max 200 characters) }.
- recommendedFocus: array of up to 3 priority skillSlugs.

Respond exclusively with the JSON object complying with the specified schema.`;

let cachedPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!cachedPrompt) {
    try {
      const promptPath = path.join(process.cwd(), 'agents', 'gap-analysis', 'prompt.md');
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
 * Executes the Gap Analysis Agent to explain skill gaps and prioritize focus.
 * Uses generateStructured with Zod validation, retry, and fixture mode support.
 */
export async function runGapAnalysisAgent(
  input: GapAnalysisAgentInput
): Promise<GapAnalysisAgentOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  return generateStructured<GapAnalysisAgentOutput>({
    schema: GapAnalysisAgentOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'gap-analysis',
  });
}
