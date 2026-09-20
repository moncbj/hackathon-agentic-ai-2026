import { z } from 'zod';
import { getGeminiClient, getGeminiModel } from './client';
import { loadFixture } from './fixtures';
import { AgentOutputError } from './errors';

export interface GenerateStructuredOptions<T> {
  schema: z.ZodType<T>;
  systemPrompt: string;
  input: string;
  fixtureKey: string;
  timeout?: number; // milliseconds, default 15000
}

/**
 * Generates structured, Zod-validated data from Gemini or from deterministic fixtures.
 *
 * - When AI_MODE=fixtures: loads the fixture, validates with Zod, and returns.
 * - When AI_MODE=live: calls Gemini requesting JSON output, validates with Zod.
 *   On validation failure, it retries ONCE. If it fails again, throws AgentOutputError.
 *
 * Callers (services) handle the deterministic fallback; retry belongs here.
 */
export async function generateStructured<T>(
  options: GenerateStructuredOptions<T>
): Promise<T> {
  const {
    schema,
    systemPrompt,
    input,
    fixtureKey,
    timeout = 15000,
  } = options;

  const aiMode = process.env.AI_MODE || 'fixtures';

  // 1. Fixtures Mode (Deterministic, zero API quota, zero network)
  if (aiMode === 'fixtures') {
    const rawFixture = loadFixture(fixtureKey);
    const parsed = schema.safeParse(rawFixture);

    if (!parsed.success) {
      throw new AgentOutputError(
        `Fixture for key "${fixtureKey}" failed schema validation.`,
        {
          fixtureKey,
          lastOutput: rawFixture,
          zodErrors: parsed.error.issues,
        }
      );
    }

    return parsed.data;
  }

  // 2. Live Mode (Calls Gemini API via @google/genai)
  const client = getGeminiClient();
  const model = getGeminiModel();

  const callModelWithTimeout = async (promptContent: string): Promise<string> => {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Gemini request timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      const apiPromise = client.models.generateContent({
        model,
        contents: promptContent,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
        },
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);
      return response.text || '';
    } finally {
      // @ts-expect-error timeoutId is assigned synchronously in promise executor
      clearTimeout(timeoutId);
    }
  };

  // Attempt 1
  let lastRawText = '';
  let lastParsedJson: unknown = null;

  try {
    lastRawText = await callModelWithTimeout(input);
  } catch (err: unknown) {
    throw new AgentOutputError(
      `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`,
      { fixtureKey, cause: err }
    );
  }

  try {
    lastParsedJson = JSON.parse(lastRawText);
  } catch {
    // If JSON parsing fails on attempt 1, prepare for retry
    lastParsedJson = { raw: lastRawText };
  }

  const firstValidation = schema.safeParse(lastParsedJson);
  if (firstValidation.success) {
    return firstValidation.data;
  }

  // Attempt 2: Retry ONCE on validation failure
  const retryPrompt = `${input}\n\nIMPORTANT: Your previous response failed schema validation with the following errors: ${JSON.stringify(
    firstValidation.error?.issues ?? 'Invalid JSON'
  )}. Return valid JSON adhering strictly to the schema.`;

  try {
    lastRawText = await callModelWithTimeout(retryPrompt);
  } catch (retryErr: unknown) {
    throw new AgentOutputError(
      `Gemini retry request failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
      {
        fixtureKey,
        lastOutput: lastParsedJson,
        zodErrors: firstValidation.error?.issues,
        cause: retryErr,
      }
    );
  }

  try {
    lastParsedJson = JSON.parse(lastRawText);
  } catch (secondParseErr: unknown) {
    throw new AgentOutputError(
      `Gemini returned invalid JSON after retry: ${secondParseErr instanceof Error ? secondParseErr.message : String(secondParseErr)}`,
      {
        fixtureKey,
        lastOutput: lastRawText,
        cause: secondParseErr,
      }
    );
  }

  const secondValidation = schema.safeParse(lastParsedJson);
  if (secondValidation.success) {
    return secondValidation.data;
  }

  // If retry also failed validation, throw typed AgentOutputError
  throw new AgentOutputError(
    `Gemini output failed schema validation after retry.`,
    {
      fixtureKey,
      lastOutput: lastParsedJson,
      zodErrors: secondValidation.error.issues,
    }
  );
}
