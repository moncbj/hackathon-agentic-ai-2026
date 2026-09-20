// agents/profile/run.ts
// Profile Agent runner invoking generateStructured with schema and prompt (SPEC-001)

import fs from 'fs';
import path from 'path';
import { generateStructured } from '@/lib/gemini/generate-structured';
import {
  ProfileAgentInput,
  ProfileAgentOutput,
  ProfileAgentOutputSchema,
} from './schema';

const DEFAULT_SYSTEM_PROMPT = `Eres el Profile Agent de EduPath. Tu función es analizar el texto de un currículum vitae (CV), portafolio o descripción de proyectos de un estudiante y proponer niveles de competencia (0 a 4) para las habilidades requeridas por su rol objetivo.

### Escala de niveles (0 a 4)
- 0: Sin conocimientos o sin mención relevante en el documento.
- 1: Principiante / nociones teóricas básicas o uso académico introductorio.
- 2: Intermedio / uso práctico demostrado en proyectos o experiencia laboral inicial.
- 3: Avanzado / experiencia profesional sólida, resolución autónoma de problemas complejos.
- 4: Experto / dominio profundo, arquitectura, liderazgo técnico o especialización comprobada.

### Reglas estrictas de evaluación
1. Evidencia textual directa: No infles niveles. Cada nivel propuesto debe estar respaldado por evidencia explícita en el documento.
2. Conservadurismo ante la duda: Si la evidencia es escasa o ambigua, propone el nivel más bajo razonable y asigna confidence: "low".
3. No inventar experiencia: No asumas herramientas o competencias no mencionadas en el texto.
4. Language: Rationale and summary must be written in clear, professional, and concise English (or the document's language).
5. Límite de longitud:
   - rationale: máximo 200 caracteres por habilidad.
   - summary: máximo 400 caracteres resumiendo el perfil general del estudiante.
6. Habilidades del rol: Para cada propuesta en proposedSkills, utiliza exactamente el skillSlug que coincida con las habilidades de roleSkills suministradas.
7. Habilidades no mapeadas: Si el documento evidencia tecnologías o habilidades relevantes que no pertenecen a roleSkills, inclúyelas en unmappedSkills.

Responde exclusivamente con el objeto JSON que cumple con el esquema especificado.`;

let cachedPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!cachedPrompt) {
    try {
      const promptPath = path.join(process.cwd(), 'agents', 'profile', 'prompt.md');
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
 * Executes the Profile Agent to analyze document text against role skills.
 * Uses generateStructured with Zod validation, retry, and fixture mode support.
 */
export async function runProfileAgent(
  input: ProfileAgentInput,
): Promise<ProfileAgentOutput> {
  const systemPrompt = getSystemPrompt();
  const inputPayload = JSON.stringify(input);

  return generateStructured<ProfileAgentOutput>({
    schema: ProfileAgentOutputSchema,
    systemPrompt,
    input: inputPayload,
    fixtureKey: 'profile',
  });
}
