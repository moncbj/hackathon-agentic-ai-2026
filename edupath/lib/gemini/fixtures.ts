import fs from 'fs';
import path from 'path';
import { AgentOutputError } from './errors';

/**
 * Loads a JSON fixture file from `data/fixtures/agents/<fixtureKey>.json`.
 * Used for deterministic testing and AI_MODE=fixtures without calling Gemini.
 */
export function loadFixture(fixtureKey: string): unknown {
  const normalizedKey = fixtureKey.endsWith('.json') ? fixtureKey : `${fixtureKey}.json`;
  const filePath = path.join(process.cwd(), 'data', 'fixtures', 'agents', normalizedKey);

  if (!fs.existsSync(filePath)) {
    throw new AgentOutputError(
      `Fixture file not found for key "${fixtureKey}" at path: ${filePath}`,
      { fixtureKey }
    );
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err: unknown) {
    throw new AgentOutputError(
      `Failed to read or parse fixture "${fixtureKey}": ${err instanceof Error ? err.message : String(err)}`,
      { fixtureKey, cause: err }
    );
  }
}
