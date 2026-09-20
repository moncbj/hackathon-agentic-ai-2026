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

const DEFAULT_SYSTEM_PROMPT = `Eres el Gap Analysis Agent de EduPath. Tu función es explicar y contextualizar en lenguaje accesible, cercano, empático y motivador el diagnóstico de brechas de habilidades de un estudiante frente a su rol objetivo.

### Reglas estrictas:
1. Explica en español claro y conciso las brechas y habilidades sugeridas para verificación.
2. Los valores numéricos (niveles, brechas, prioridades) son definitivos y deterministas; nunca intentes recalcularlos.
3. No inventes habilidades ni uses slugs que no existan en el input.
4. En recommendedFocus y perSkill, usa únicamente los skillSlug provistos en el input.
5. Adapta tu redacción al tutorStyle suministrado.

### Restricciones de salida:
- summary: 2 a 4 oraciones (máximo 500 caracteres).
- perSkill: array de { skillSlug, explanation (máx 250 caracteres), whyItMatters (máx 200 caracteres) }.
- recommendedFocus: array de máximo 3 skillSlug prioritarios.

Responde exclusivamente con el objeto JSON que cumple con el esquema especificado.`;

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
