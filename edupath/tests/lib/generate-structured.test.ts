import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { generateStructured } from '@/lib/gemini/generate-structured';
import { AgentOutputError } from '@/lib/gemini/errors';
import * as geminiClientModule from '@/lib/gemini/client';

describe('lib/gemini/generate-structured', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Fixtures Mode (AI_MODE=fixtures)', () => {
    it('should return parsed and validated fixture when schema matches', async () => {
      process.env.AI_MODE = 'fixtures';

      const TestSchema = z.object({
        status: z.string(),
        message: z.string().optional(),
      });

      const result = await generateStructured({
        schema: TestSchema,
        systemPrompt: 'System prompt',
        input: 'Test input',
        fixtureKey: 'health-check',
      });

      expect(result).toEqual({
        status: 'ok',
        message: 'AI subsystem operational',
      });
    });

    it('should throw AgentOutputError when fixture fails schema validation', async () => {
      process.env.AI_MODE = 'fixtures';

      const StrictSchema = z.object({
        requiredNumber: z.number(),
        status: z.literal('active'),
      });

      await expect(
        generateStructured({
          schema: StrictSchema,
          systemPrompt: 'System prompt',
          input: 'Test input',
          fixtureKey: 'invalid-schema-test',
        })
      ).rejects.toThrow(AgentOutputError);
    });

    it('should throw AgentOutputError when fixture file does not exist', async () => {
      process.env.AI_MODE = 'fixtures';

      const TestSchema = z.object({ status: z.string() });

      await expect(
        generateStructured({
          schema: TestSchema,
          systemPrompt: 'System prompt',
          input: 'Test input',
          fixtureKey: 'non-existent-fixture',
        })
      ).rejects.toThrow(AgentOutputError);
    });
  });

  describe('Live Mode (AI_MODE=live)', () => {
    it('should return validated output on first successful response', async () => {
      process.env.AI_MODE = 'live';

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({ score: 95, summary: 'Passed all tests' }),
      });

      vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as ReturnType<typeof geminiClientModule.getGeminiClient>);

      vi.spyOn(geminiClientModule, 'getGeminiModel').mockReturnValue('gemini-2.0-flash');

      const Schema = z.object({
        score: z.number(),
        summary: z.string(),
      });

      const result = await generateStructured({
        schema: Schema,
        systemPrompt: 'You evaluate tests',
        input: 'Learner output',
        fixtureKey: 'health-check',
      });

      expect(result).toEqual({ score: 95, summary: 'Passed all tests' });
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should retry once when first response fails schema validation and return if retry passes', async () => {
      process.env.AI_MODE = 'live';

      const mockGenerateContent = vi
        .fn()
        // First attempt: invalid format
        .mockResolvedValueOnce({
          text: JSON.stringify({ invalidField: 'missing score' }),
        })
        // Second attempt (retry): valid format
        .mockResolvedValueOnce({
          text: JSON.stringify({ score: 80, summary: 'Recovered on retry' }),
        });

      vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as ReturnType<typeof geminiClientModule.getGeminiClient>);

      vi.spyOn(geminiClientModule, 'getGeminiModel').mockReturnValue('gemini-2.0-flash');

      const Schema = z.object({
        score: z.number(),
        summary: z.string(),
      });

      const result = await generateStructured({
        schema: Schema,
        systemPrompt: 'Prompt',
        input: 'Input',
        fixtureKey: 'health-check',
      });

      expect(result).toEqual({ score: 80, summary: 'Recovered on retry' });
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should throw AgentOutputError when both first attempt and retry fail validation', async () => {
      process.env.AI_MODE = 'live';

      const mockGenerateContent = vi
        .fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({ bad: 1 }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({ bad: 2 }),
        });

      vi.spyOn(geminiClientModule, 'getGeminiClient').mockReturnValue({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as ReturnType<typeof geminiClientModule.getGeminiClient>);

      vi.spyOn(geminiClientModule, 'getGeminiModel').mockReturnValue('gemini-2.0-flash');

      const Schema = z.object({
        expectedField: z.string(),
      });

      await expect(
        generateStructured({
          schema: Schema,
          systemPrompt: 'Prompt',
          input: 'Input',
          fixtureKey: 'health-check',
        })
      ).rejects.toThrow(AgentOutputError);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });
});
