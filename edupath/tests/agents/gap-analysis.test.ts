// tests/agents/gap-analysis.test.ts
// Unit tests for Gap Analysis Agent schema and runner (SPEC-002)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GapAnalysisAgentInputSchema,
  GapAnalysisAgentOutputSchema,
} from '@/agents/gap-analysis/schema';
import { runGapAnalysisAgent } from '@/agents/gap-analysis/run';
import { loadFixture } from '@/lib/gemini/fixtures';

describe('Gap Analysis Agent Contract & Fixture', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates that data/fixtures/agents/gap-analysis.json satisfies GapAnalysisAgentOutputSchema', () => {
    const rawFixture = loadFixture('gap-analysis');
    const parsed = GapAnalysisAgentOutputSchema.safeParse(rawFixture);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.summary.length).toBeGreaterThan(0);
      expect(parsed.data.summary.length).toBeLessThanOrEqual(500);
      expect(parsed.data.perSkill.length).toBeGreaterThan(0);
      expect(parsed.data.recommendedFocus.length).toBeGreaterThan(0);
      expect(parsed.data.recommendedFocus.length).toBeLessThanOrEqual(3);

      for (const skill of parsed.data.perSkill) {
        expect(skill.skillSlug.length).toBeGreaterThan(0);
        expect(skill.explanation.length).toBeLessThanOrEqual(250);
        expect(skill.whyItMatters.length).toBeLessThanOrEqual(200);
      }
    }
  });

  it('runs runGapAnalysisAgent in AI_MODE=fixtures and returns parsed fixture output', async () => {
    process.env.AI_MODE = 'fixtures';

    const result = await runGapAnalysisAgent({
      role: { name: 'Data Analyst (junior)' },
      gaps: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          level: 1,
          requiredLevel: 3,
          gap: 2,
          priority: 10,
        },
      ],
      toVerify: [
        {
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
        },
      ],
      tutorStyle: {
        language: 'es',
        tone: 'cercano',
        detailLevel: 'equilibrado',
        useAnalogies: true,
        freeInstructions: '',
      },
    });

    expect(result.summary).toBeDefined();
    expect(result.perSkill.length).toBeGreaterThan(0);
    expect(result.recommendedFocus.length).toBeLessThanOrEqual(3);
  });

  it('validates a compliant GapAnalysisAgentInput', () => {
    const validInput = {
      role: { name: 'Data Analyst' },
      gaps: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          level: 1,
          requiredLevel: 3,
          gap: 2,
          priority: 10,
        },
      ],
      toVerify: [
        {
          skillSlug: 'spreadsheets',
          name: 'Spreadsheets',
          level: 3,
        },
      ],
      tutorStyle: {
        language: 'es',
        tone: 'cercano',
        detailLevel: 'equilibrado',
        useAnalogies: true,
        freeInstructions: 'Be direct and friendly',
      },
    };

    const parsed = GapAnalysisAgentInputSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);
  });

  it('rejects input with invalid skill level or negative priority', () => {
    const invalidInput = {
      role: { name: 'Data Analyst' },
      gaps: [
        {
          skillSlug: 'sql',
          name: 'SQL',
          level: 5, // Invalid level > 4
          requiredLevel: 3,
          gap: 2,
          priority: -1, // Invalid negative priority
        },
      ],
      toVerify: [],
      tutorStyle: {
        language: 'es',
        tone: 'cercano',
        detailLevel: 'equilibrado',
        useAnalogies: true,
        freeInstructions: '',
      },
    };

    const parsed = GapAnalysisAgentInputSchema.safeParse(invalidInput);
    expect(parsed.success).toBe(false);
  });

  it('rejects output with recommendedFocus having more than 3 skills', () => {
    const invalidOutput = {
      summary: 'Resumen válido del perfil.',
      perSkill: [],
      recommendedFocus: ['skill-1', 'skill-2', 'skill-3', 'skill-4'], // > 3
    };

    const parsed = GapAnalysisAgentOutputSchema.safeParse(invalidOutput);
    expect(parsed.success).toBe(false);
  });

  it('rejects output when explanation or whyItMatters exceed char limits', () => {
    const invalidOutput = {
      summary: 'Resumen válido.',
      perSkill: [
        {
          skillSlug: 'sql',
          explanation: 'a'.repeat(251), // Max 250
          whyItMatters: 'b'.repeat(200),
        },
      ],
      recommendedFocus: ['sql'],
    };

    const parsed = GapAnalysisAgentOutputSchema.safeParse(invalidOutput);
    expect(parsed.success).toBe(false);
  });
});
