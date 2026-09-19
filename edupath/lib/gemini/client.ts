import { GoogleGenAI } from '@google/genai';

let geminiInstance: GoogleGenAI | null = null;

/**
 * Returns the configured Gemini SDK client instance.
 * Server-side only. All SDK imports are isolated under lib/gemini/.
 */
export function getGeminiClient(): GoogleGenAI {
  if (geminiInstance) {
    return geminiInstance;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  geminiInstance = new GoogleGenAI({ apiKey });
  return geminiInstance;
}

/**
 * Returns the configured model name from GEMINI_MODEL env var,
 * defaulting to 'gemini-2.0-flash'.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}
