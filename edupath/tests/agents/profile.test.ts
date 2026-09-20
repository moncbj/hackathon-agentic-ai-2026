import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProfileAgentInputSchema,
  ProfileAgentOutputSchema,
} from '@/agents/profile/schema';
import { runProfileAgent } from '@/agents/profile/run';
import { loadFixture } from '@/lib/gemini/fixtures';

describe('Profile Agent Contract & Fixture', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates that data/fixtures/agents/profile.json satisfies ProfileAgentOutputSchema', () => {
    const rawFixture = loadFixture('profile');
    const parsed = ProfileAgentOutputSchema.safeParse(rawFixture);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.proposedSkills.length).toBeGreaterThan(0);
      expect(parsed.data.unmappedSkills.length).toBeGreaterThan(0);
      expect(parsed.data.summary.length).toBeGreaterThan(0);
      expect(parsed.data.summary.length).toBeLessThanOrEqual(400);

      for (const skill of parsed.data.proposedSkills) {
        expect(skill.proposedLevel).toBeGreaterThanOrEqual(0);
        expect(skill.proposedLevel).toBeLessThanOrEqual(4);
        expect(skill.rationale.length).toBeLessThanOrEqual(200);
        expect(['low', 'medium', 'high']).toContain(skill.confidence);
      }
    }
  });

  it('runs runProfileAgent in AI_MODE=fixtures and returns parsed fixture output', async () => {
    process.env.AI_MODE = 'fixtures';

    const result = await runProfileAgent({
      documentText: 'Experienced with Python and SQL in academic and personal projects.',
      roleSkills: [
        { slug: 'basic-python', name: 'Basic Python' },
        { slug: 'sql', name: 'SQL' },
      ],
    });

    expect(result.proposedSkills).toBeDefined();
    expect(result.summary).toContain('Python');
  });

  it('rejects output with proposedLevel outside 0-4', () => {
    const invalidData = {
      proposedSkills: [
        {
          skillSlug: 'sql',
          proposedLevel: 5,
          rationale: 'Invalid level',
          confidence: 'high',
        },
      ],
      unmappedSkills: [],
      summary: 'Summary',
    };

    const parsed = ProfileAgentOutputSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('rejects output with invalid confidence value', () => {
    const invalidData = {
      proposedSkills: [
        {
          skillSlug: 'sql',
          proposedLevel: 2,
          rationale: 'Valid rationale',
          confidence: 'extreme', // Invalid enum
        },
      ],
      unmappedSkills: [],
      summary: 'Summary',
    };

    const parsed = ProfileAgentOutputSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('rejects rationale exceeding 200 characters or summary exceeding 400 characters', () => {
    const invalidRationale = {
      proposedSkills: [
        {
          skillSlug: 'sql',
          proposedLevel: 2,
          rationale: 'A'.repeat(201),
          confidence: 'low',
        },
      ],
      unmappedSkills: [],
      summary: 'Valid summary',
    };
    expect(ProfileAgentOutputSchema.safeParse(invalidRationale).success).toBe(false);

    const invalidSummary = {
      proposedSkills: [],
      unmappedSkills: [],
      summary: 'A'.repeat(401),
    };
    expect(ProfileAgentOutputSchema.safeParse(invalidSummary).success).toBe(false);
  });

  it('validates input schema bounds', () => {
    // Empty document text should fail
    const emptyDoc = ProfileAgentInputSchema.safeParse({
      documentText: '',
      roleSkills: [{ slug: 'sql', name: 'SQL' }],
    });
    expect(emptyDoc.success).toBe(false);

    // Oversized document text (>20000 chars) should fail
    const hugeDoc = ProfileAgentInputSchema.safeParse({
      documentText: 'A'.repeat(20001),
      roleSkills: [{ slug: 'sql', name: 'SQL' }],
    });
    expect(hugeDoc.success).toBe(false);

    // Valid input should succeed
    const valid = ProfileAgentInputSchema.safeParse({
      documentText: 'A'.repeat(500),
      roleSkills: [{ slug: 'sql', name: 'SQL' }],
      declaredLevels: { sql: 2 },
    });
    expect(valid.success).toBe(true);
  });
});
